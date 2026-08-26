from typing import Dict, List
from pydantic import BaseModel


class EnvironmentTheme(BaseModel):
    id: str
    name: str
    icon: str
    category: str
    description: str
    queries: List[str]
    subthemes: List[str]
    negative_terms: List[str] = [
        "raw", "raw video", "log footage", "slog", "s-log", "flat profile", "ungraded", "uncolored", "flat color",
        "grey", "gray", "dull", "desaturated", "washed out", "drab", "monochrome", "lifeless", "murky", "muddy", "faded",
        "gloomy", "dark", "overcast", "dreary", "depressing", "bleak",
        "foggy dark", "night", "shadowy", "people", "person", "animal", "bird",
        "building", "house", "road", "car", "vehicle", "city", "crowd", "traffic",
        "storm", "lightning", "surfing", "timelapse", "hyperlapse", "fast movement",
        "drone flyby", "text", "logo", "flashing", "neon"
    ]
    preferred_colors: List[str] = ["soft green", "warm gold", "pale blue"]
    visual_style: str = "bright sunlit natural landscape"
    minimum_intent_score: float = 8.0
    minimum_theme_score: float = 8.0
    minimum_calmness_score: float = 8.0
    maximum_motion_intensity: float = 4.0
    minimum_visual_quality: float = 7.0


NATURE_ENVIRONMENTS: Dict[str, EnvironmentTheme] = {
    "sunlit_forest": EnvironmentTheme(
        id="sunlit_forest",
        name="Sunlit Forest & Woodland Canopy",
        icon="🌲",
        category="Forest",
        description="Bright sunbeams through vibrant green canopy and peaceful woodland paths",
        queries=[
            "sunlight through forest trees",
            "bright green woodland canopy",
            "sunlit quiet forest path",
            "mossy sunlit forest",
            "peaceful sunlit woodland",
            "soft sunlight trees calm",
            "lush green trees daylight"
        ],
        subthemes=["sunbeams in trees", "green canopy", "sunlit forest path", "moss and ferns"],
        preferred_colors=["vibrant green", "warm gold", "emerald", "soft amber"]
    ),
    "calm_ocean": EnvironmentTheme(
        id="calm_ocean",
        name="Calm Ocean & Turquoise Waves",
        icon="🌊",
        category="Water",
        description="Crystal clear turquoise shallow water and gentle soothing ripples",
        queries=[
            "crystal clear calm sea",
            "calm turquoise shoreline",
            "gentle shallow sea ripples",
            "placid blue ocean surface",
            "soft waves sand shore daylight",
            "peaceful turquoise ocean horizon"
        ],
        subthemes=["gentle shore waves", "turquoise horizon", "shallow crystal water", "calm sea ripples"],
        preferred_colors=["turquoise", "pale blue", "seafoam", "soft white"]
    ),
    "wildflower_meadow": EnvironmentTheme(
        id="wildflower_meadow",
        name="Sun-Drenched Wildflower Meadow",
        icon="🌸",
        category="Meadow",
        description="Colorful blooming wildflowers swaying gently under warm sunshine",
        queries=[
            "sunlit wildflower meadow",
            "blooming wildflower field",
            "gentle breeze colorful meadow",
            "sunlit pastoral meadow grass",
            "lavender hills sunshine",
            "bright wildflowers countryside"
        ],
        subthemes=["blooming wildflowers", "swaying golden grass", "sunlit pasture", "lavender breeze"],
        preferred_colors=["golden yellow", "lavender", "soft pink", "fresh green"]
    ),
    "mountain_lake": EnvironmentTheme(
        id="mountain_lake",
        name="Crystal Mountain Lakes",
        icon="🏞️",
        category="Water",
        description="Placid mirror-like alpine lakes reflecting clear skies and pine ridges",
        queries=[
            "still alpine lake reflection",
            "crystal clear mountain lake",
            "peaceful mountain lake shore",
            "calm lake water daylight",
            "placid mountain lake reflection"
        ],
        subthemes=["mirror lake reflection", "crystal alpine shore", "still water surface", "pine lake border"],
        preferred_colors=["sapphire blue", "pine green", "clear crystal", "soft white"]
    ),
    "golden_sunrise": EnvironmentTheme(
        id="golden_sunrise",
        name="Golden Sunrise & Dawn Valleys",
        icon="🌄",
        category="Sky",
        description="Warm golden morning light illuminating peaceful rolling hills and valleys",
        queries=[
            "warm golden sunrise valley",
            "soft sunrise glow nature hills",
            "peaceful morning dawn light landscape",
            "golden morning light pasture",
            "gentle sunrise hill illumination"
        ],
        subthemes=["golden morning mist", "warm sunrise glow", "gentle rolling hills dawn", "sunlit valley horizon"],
        preferred_colors=["warm gold", "soft amber", "rose peach", "honey yellow"]
    ),
    "lush_rainforest": EnvironmentTheme(
        id="lush_rainforest",
        name="Lush Rainforest & Tropics",
        icon="🌿",
        category="Forest",
        description="Rich emerald tropical foliage, dew drops, and peaceful green canopies",
        queries=[
            "lush rainforest green canopy",
            "dew drops tropical green leaves",
            "peaceful green jungle foliage",
            "sunlit tropical rainforest calm",
            "vibrant moss and tropical plants"
        ],
        subthemes=["tropical canopy", "dew on leaves", "vibrant moss and palms", "gentle jungle light"],
        preferred_colors=["deep emerald", "vibrant moss", "sunlit jade", "leaf green"]
    ),
    "cascading_waterfalls": EnvironmentTheme(
        id="cascading_waterfalls",
        name="Gentle Waterfalls & Cascades",
        icon="💧",
        category="Water",
        description="Clear bubbling streams and soft mossy cascading waterfalls",
        queries=[
            "gentle mossy waterfall stream",
            "clear bubbling forest creek",
            "crystal water cascade nature",
            "peaceful shallow river stream",
            "tranquil small waterfall pond"
        ],
        subthemes=["mossy waterfall", "bubbling brook", "crystal cascade", "clear pebble creek"],
        preferred_colors=["crystal blue", "emerald moss", "white foam", "slate grey"]
    ),
    "golden_grasslands": EnvironmentTheme(
        id="golden_grasslands",
        name="Golden Grasslands & Rolling Hills",
        icon="🌾",
        category="Meadow",
        description="Endless fields of sunlit tall grass gently swaying in the breeze",
        queries=[
            "sunlit tall grass swaying breeze",
            "golden grass rolling hills",
            "peaceful pastoral grassland daylight",
            "sun-drenched golden wheat field calm",
            "open green rolling hills daylight"
        ],
        subthemes=["swaying golden grass", "sunlit rolling hills", "pastoral breeze", "golden field horizon"],
        preferred_colors=["warm gold", "wheat amber", "soft green", "warm bronze"]
    ),
    "bamboo_groves": EnvironmentTheme(
        id="bamboo_groves",
        name="Bamboo Groves & Zen Gardens",
        icon="🎋",
        category="Zen",
        description="Tall green bamboo stalks swaying gracefully with zen stone gardens",
        queries=[
            "sunlit tall bamboo forest",
            "gentle swaying bamboo stalks",
            "peaceful zen bamboo grove",
            "tranquil moss stone garden",
            "bright green bamboo nature"
        ],
        subthemes=["swaying bamboo stalks", "zen stone garden", "sunlit bamboo canopy", "moss and bamboo"],
        preferred_colors=["bamboo green", "warm gold", "soft jade", "river stone grey"]
    ),
    "cherry_blossoms": EnvironmentTheme(
        id="cherry_blossoms",
        name="Cherry Blossoms & Blooming Orchards",
        icon="🌸",
        category="Flora",
        description="Delicate pink blossoms and blooming spring fruit orchards in soft sunlight",
        queries=[
            "sunlit pink cherry blossom trees",
            "blooming spring orchard blossoms",
            "gentle sakura petals daylight",
            "peaceful blooming flower trees",
            "spring apple blossom orchard sunshine"
        ],
        subthemes=["pink blossom branches", "blooming orchard canopy", "sunlit sakura", "spring floral breeze"],
        preferred_colors=["pastel pink", "soft white", "blossom rose", "fresh green"]
    ),
    "sandy_beach": EnvironmentTheme(
        id="sandy_beach",
        name="Soft Sandy Beach & Coastline",
        icon="🏖️",
        category="Water",
        description="Warm golden sands, gentle sea breezes, and pristine coastal shores",
        queries=[
            "warm golden sand beach calm",
            "peaceful sandy coastal shoreline",
            "gentle waves golden beach daylight",
            "placid sandy shoreline horizon",
            "sunlit coastal sand dunes calm"
        ],
        subthemes=["golden sand ripples", "peaceful shoreline", "gentle beach wash", "coastal dune grass"],
        preferred_colors=["golden sand", "ocean turquoise", "warm ivory", "sky blue"]
    ),
    "ethereal_clouds": EnvironmentTheme(
        id="ethereal_clouds",
        name="Ethereal Clouds & Sky Horizons",
        icon="☁️",
        category="Sky",
        description="Gentle, slow-drifting white clouds over peaceful azure sky horizons",
        queries=[
            "slow soft white clouds blue sky",
            "peaceful ethereal sky horizon",
            "gentle bright cloud drifting daylight",
            "pastel morning sky soft clouds",
            "calm azure sky horizon"
        ],
        subthemes=["slow white clouds", "peaceful blue horizon", "soft daytime sky", "gentle aerial vista"],
        preferred_colors=["sky blue", "pure white", "soft cream", "pale azure"]
    ),
    "autumn_woodlands": EnvironmentTheme(
        id="autumn_woodlands",
        name="Warm Autumn Woodlands",
        icon="🍁",
        category="Forest",
        description="Rich golden amber leaves and warm sun-dappled autumn tree groves",
        queries=[
            "sunlit golden autumn forest",
            "warm amber fall leaves trees",
            "peaceful autumn maple grove daylight",
            "sunbeams through golden autumn leaves",
            "golden yellow autumn foliage"
        ],
        subthemes=["golden maple leaves", "sunlit amber forest", "warm fall canopy", "golden leaf path"],
        preferred_colors=["rich amber", "golden yellow", "warm copper", "crimson gold"]
    ),
    "desert_dunes": EnvironmentTheme(
        id="desert_dunes",
        name="Warm Desert Dunes & Sandstone",
        icon="🏜️",
        category="Zen",
        description="Smooth, sculpted golden sand dunes and peaceful sunlit sandstone canyons",
        queries=[
            "smooth golden sand dunes ripples",
            "sunlit desert sand dunes calm",
            "peaceful golden sandstone canyon",
            "warm desert dunes horizon daylight",
            "serene sand ripples sunshine"
        ],
        subthemes=["sand dune ripples", "sunlit canyon wall", "golden desert horizon", "sculpted sandstone"],
        preferred_colors=["terracotta", "warm sand", "golden ochre", "desert amber"]
    ),
    "lotus_ponds": EnvironmentTheme(
        id="lotus_ponds",
        name="Lotus Ponds & Water Lilies",
        icon="🪷",
        category="Water",
        description="Tranquil mirror ponds with floating pink lotus blossoms and water lilies",
        queries=[
            "blooming pink lotus pond daylight",
            "still pond water lilies calm",
            "peaceful lotus flower water ripples",
            "clear water lily pond sunshine",
            "floating green lily pads pond"
        ],
        subthemes=["blooming lotus flower", "floating water lilies", "still pond reflection", "green lily pads"],
        preferred_colors=["lotus pink", "water lily white", "pad green", "pond sapphire"]
    ),
    "alpine_valleys": EnvironmentTheme(
        id="alpine_valleys",
        name="Alpine Valleys & Pine Ridges",
        icon="🏔️",
        category="Mountain",
        description="Sun-drenched alpine meadows framed by majestic pine ridges",
        queries=[
            "sunlit alpine valley green meadow",
            "peaceful mountain valley pines daylight",
            "green alpine meadow mountain view",
            "sunlit pine ridge valley landscape",
            "alpine countryside sunshine"
        ],
        subthemes=["alpine green valley", "pine mountain ridge", "sunlit mountain pasture", "highland meadow"],
        preferred_colors=["alpine green", "pine emerald", "sky blue", "snow white"]
    ),
    "tropical_lagoons": EnvironmentTheme(
        id="tropical_lagoons",
        name="Tropical Island Lagoons",
        icon="🌴",
        category="Water",
        description="Swaying palm fronds and crystal clear emerald lagoons under warm sunshine",
        queries=[
            "swaying palm trees tropical beach",
            "crystal clear tropical lagoon daylight",
            "sunlit palm trees turquoise water",
            "peaceful tropical island shore calm",
            "clear shallow turquoise lagoon"
        ],
        subthemes=["swaying palm fronds", "crystal lagoon", "turquoise shallows", "tropical island shore"],
        preferred_colors=["lagoon turquoise", "palm green", "sunlit coral", "warm gold"]
    ),
    "riverbed_pebbles": EnvironmentTheme(
        id="riverbed_pebbles",
        name="Peaceful Riverbed & Pebbles",
        icon="🪨",
        category="Water",
        description="Shallow crystal clear water gliding over smooth colorful river stones",
        queries=[
            "clear water smooth river stones",
            "sunlit riverbed colorful pebbles",
            "gentle shallow river clear water",
            "peaceful stream smooth rocks daylight",
            "crystal water flowing riverbed"
        ],
        subthemes=["smooth river stones", "crystal shallow stream", "sunlit pebble ripples", "calm riverbed"],
        preferred_colors=["clear water", "river stone amber", "slate blue", "golden pebble"]
    ),
    "sunset_twilight": EnvironmentTheme(
        id="sunset_twilight",
        name="Pastel Sunset & Twilight Glow",
        icon="🌅",
        category="Sky",
        description="Soft, tranquil sunset skies painted with gentle pink, lavender, and gold",
        queries=[
            "soft pastel sunset sky ocean",
            "gentle golden evening horizon calm",
            "peaceful pastel pink sunset landscape",
            "calm sunset lake reflection soft glow",
            "warm evening sky twilight calm"
        ],
        subthemes=["pastel sunset sky", "golden evening horizon", "calm sunset reflection", "soft pink twilight"],
        preferred_colors=["pastel peach", "lavender pink", "soft gold", "warm violet"]
    ),
    "fern_canyon": EnvironmentTheme(
        id="fern_canyon",
        name="Fern Canyon & Mossy Grotto",
        icon="🍃",
        category="Forest",
        description="Vibrant green fern-covered walls, mossy rock alcoves, and gentle sunbeams",
        queries=[
            "vibrant green fern canyon",
            "mossy rock forest stream sunshine",
            "lush green fern gorge daylight",
            "peaceful sunlit mossy hollow",
            "fresh green ferns nature sunlight"
        ],
        subthemes=["fern canyon walls", "mossy rock alcove", "sunlit fern fronds", "lush forest hollow"],
        preferred_colors=["fern green", "moss emerald", "spring jade", "sunlit gold"]
    ),
}

# Compatibility dictionary for preset lookups by id and legacy names
NATURE_PRESETS: Dict[str, EnvironmentTheme] = {}
for k, v in NATURE_ENVIRONMENTS.items():
    NATURE_PRESETS[k] = v
    NATURE_PRESETS[v.name] = v

# Legacy aliases
if "sunlit_forest" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Calm Misty Forest"] = NATURE_ENVIRONMENTS["sunlit_forest"]
if "calm_ocean" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Calm Ocean"] = NATURE_ENVIRONMENTS["calm_ocean"]
if "mountain_lake" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Mountain Lake"] = NATURE_ENVIRONMENTS["mountain_lake"]

