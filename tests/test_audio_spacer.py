import os
import wave
import struct
import math
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import settings
from backend.app.services.audio_spacer_service import audio_spacer_service, DEFAULT_PAUSE_DURATIONS

client = TestClient(app)


def create_test_sine_wav(path: Path, duration_sec: float = 2.0, sample_rate: int = 44100):
    """Creates a clean test sine wave PCM WAV file."""
    n_frames = int(duration_sec * sample_rate)
    frames = bytearray()
    for i in range(n_frames):
        # 440 Hz tone
        val = int(10000 * math.sin(2 * math.pi * 440 * (i / sample_rate)))
        # Stereo 16-bit
        frames.extend(struct.pack('<hh', val, val))
    
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)


def test_parse_script_tags():
    script = """
    First sentence. (pause)
    Second sentence. (short pause)
    Third sentence. (long pause)
    Fourth sentence. (15s pause)
    Fifth sentence. (double long pause)
    Closing phrase without tag.
    """
    entries = audio_spacer_service.parse_script(script)
    assert len(entries) == 6
    assert entries[0]["text"] == "First sentence."
    assert entries[0]["pause_duration"] == DEFAULT_PAUSE_DURATIONS["pause"]
    assert entries[1]["pause_duration"] == DEFAULT_PAUSE_DURATIONS["short"]
    assert entries[2]["pause_duration"] == DEFAULT_PAUSE_DURATIONS["long pause"]
    assert entries[3]["pause_duration"] == 15.0
    assert entries[4]["pause_duration"] == DEFAULT_PAUSE_DURATIONS["double long pause"]
    assert entries[5]["pause_duration"] == 4.0


def test_waveform_peak_extraction(tmp_path):
    wav_path = tmp_path / "test_peaks.wav"
    create_test_sine_wav(wav_path, duration_sec=1.0)
    peaks = audio_spacer_service.extract_waveform_peaks(wav_path, num_peaks=100)
    assert len(peaks) == 100
    assert all(0.0 <= p <= 1.0 for p in peaks)
    assert any(p > 0.1 for p in peaks)


def test_smooth_fade():
    # 100 samples of 10000 amplitude
    raw = struct.pack('<200h', *([10000] * 200))
    faded = audio_spacer_service.apply_smooth_fade(raw, num_frames=50, n_channels=2, fade_type="in")
    samples = struct.unpack('<200h', faded)
    # First sample should be close to 0
    assert abs(samples[0]) < 1000
    # 50th frame should be near 10000
    assert samples[100] > 9000


@pytest.mark.asyncio
async def test_splice_and_render_spaced_audio(tmp_path):
    input_wav = tmp_path / "input.wav"
    output_mp3 = tmp_path / "output.mp3"
    create_test_sine_wav(input_wav, duration_sec=3.0)

    segments = [
        {
            "id": "seg_1",
            "index": 0,
            "text": "First segment",
            "start_time": 0.0,
            "end_time": 1.5,
            "split_time": 1.5,
            "pause_duration": 4.0
        }
    ]

    res = await audio_spacer_service.splice_and_render_spaced_audio(
        input_wav=input_wav,
        segments=segments,
        output_mp3=output_mp3,
        fade_duration=0.05
    )

    assert res["original_duration"] == 3.0
    # 3.0s audio + 4.0s pause + 1.5s lead-in + 3.0s quiet tail = ~11.5s
    assert res["spaced_duration"] > 10.0
    assert res["total_pauses_count"] == 1
    assert output_mp3.exists()
    assert len(res["waveform_peaks"]) > 0


def test_api_audio_upload_and_process(tmp_path):
    test_wav = tmp_path / "api_test.wav"
    create_test_sine_wav(test_wav, duration_sec=2.0)

    with open(test_wav, "rb") as f:
        res = client.post(
            "/api/audio/upload",
            files={"file": ("api_test.wav", f, "audio/wav")},
            data={"script_text": "Hello world. (pause)\nSecond line."}
        )

    assert res.status_code == 200
    data = res.json()
    assert "file_id" in data
    assert data["duration"] == 2.0
    assert len(data["waveform_peaks"]) > 0
    assert len(data["segments"]) >= 1

    file_id = data["file_id"]
    segments = data["segments"]
    segments[0]["pause_duration"] = 5.0

    # Process spacing
    proc_res = client.post(
        "/api/audio/process",
        json={"file_id": file_id, "segments": segments}
    )
    assert proc_res.status_code == 200
    proc_data = proc_res.json()
    assert proc_data["spaced_duration"] > proc_data["original_duration"]
    assert "download_url" in proc_data
    assert "audio_url" in proc_data


def test_audio_projects_inbox_and_batch_upload(tmp_path):
    wav1 = tmp_path / "batch_1.wav"
    wav2 = tmp_path / "batch_2.wav"
    create_test_sine_wav(wav1, duration_sec=1.5)
    create_test_sine_wav(wav2, duration_sec=2.5)

    with open(wav1, "rb") as f1, open(wav2, "rb") as f2:
        res = client.post(
            "/api/audio/projects/batch-upload",
            files=[
                ("files", ("batch_1.wav", f1, "audio/wav")),
                ("files", ("batch_2.wav", f2, "audio/wav")),
            ]
        )

    assert res.status_code == 200
    batch_data = res.json()
    assert len(batch_data) == 2
    assert batch_data[0]["status"] == "unprocessed"
    assert batch_data[1]["status"] == "unprocessed"

    # List all projects
    list_res = client.get("/api/audio/projects")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total_count"] >= 2
    assert list_data["unprocessed_count"] >= 2

    # Get single project
    proj_id = batch_data[0]["id"]
    get_res = client.get(f"/api/audio/projects/{proj_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == proj_id

    # Delete project
    del_res = client.delete(f"/api/audio/projects/{proj_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

