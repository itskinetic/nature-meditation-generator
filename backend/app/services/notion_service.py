import logging
from typing import Any, Dict, List, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)

NOTION_API_VERSION = "2022-06-28"
NOTION_API_BASE = "https://api.notion.com/v1"


def get_notion_headers(api_key: Optional[str] = None) -> Dict[str, str]:
    key = api_key or settings.NOTION_API_KEY
    return {
        "Authorization": f"Bearer {key}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
    }


def extract_page_title(properties: Dict[str, Any]) -> str:
    """Find and extract title from Notion page properties regardless of property name."""
    for prop_name, prop_data in properties.items():
        if prop_data.get("type") == "title":
            title_list = prop_data.get("title", [])
            if title_list:
                return "".join([t.get("plain_text", "") for t in title_list]).strip()
    return "Untitled Notion Meditation"


def extract_page_status(properties: Dict[str, Any]) -> Optional[str]:
    """Extract status from Notion status or select property."""
    for prop_name, prop_data in properties.items():
        prop_type = prop_data.get("type")
        if prop_type == "status":
            status_obj = prop_data.get("status")
            if status_obj:
                return status_obj.get("name")
        elif prop_type == "select" and "status" in prop_name.lower():
            select_obj = prop_data.get("select")
            if select_obj:
                return select_obj.get("name")
    return None


def extract_page_script(properties: Dict[str, Any]) -> str:
    """Extract guidance script or notes from rich_text properties."""
    script_parts: List[str] = []
    
    # Check properties for script / guidance / notes
    for prop_name, prop_data in properties.items():
        prop_type = prop_data.get("type")
        lower_name = prop_name.lower()
        if prop_type == "rich_text" and any(k in lower_name for k in ["script", "guidance", "note", "desc", "content"]):
            text_list = prop_data.get("rich_text", [])
            for t in text_list:
                script_parts.append(t.get("plain_text", ""))
    
    return "\n".join(script_parts).strip()


def extract_page_duration(properties: Dict[str, Any]) -> Optional[int]:
    """Extract target duration if number property is present."""
    for prop_name, prop_data in properties.items():
        prop_type = prop_data.get("type")
        lower_name = prop_name.lower()
        if prop_type == "number" and any(k in lower_name for k in ["duration", "min", "time", "length"]):
            val = prop_data.get("number")
            if val is not None:
                return int(val)
    return None


def extract_page_tags(properties: Dict[str, Any]) -> List[str]:
    """Extract multi-select tags/moods."""
    tags: List[str] = []
    for prop_name, prop_data in properties.items():
        if prop_data.get("type") == "multi_select":
            ms_list = prop_data.get("multi_select", [])
            for item in ms_list:
                name = item.get("name")
                if name:
                    tags.append(name)
    return tags


async def fetch_notion_database_items(
    database_id: Optional[str] = None,
    api_key: Optional[str] = None,
    filter_status: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch live rows/pages from the configured Notion database.
    """
    db_id = database_id or settings.NOTION_DATABASE_ID
    key = api_key or settings.NOTION_API_KEY

    if not key or not db_id:
        return {
            "connected": False,
            "error": "NOTION_API_KEY or NOTION_DATABASE_ID is not configured in environment.",
            "items": [],
        }

    # Clean database ID format (strip dashes or URL prefixes if user passed full URL)
    clean_db_id = db_id.split("/")[-1].split("?")[0].replace("-", "")

    url = f"{NOTION_API_BASE}/databases/{clean_db_id}/query"
    headers = get_notion_headers(key)
    payload: Dict[str, Any] = {
        "page_size": 50,
        "sorts": [
            {
                "timestamp": "last_edited_time",
                "direction": "descending",
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                error_data = response.json()
                logger.error(f"Notion API error ({response.status_code}): {error_data}")
                return {
                    "connected": False,
                    "error": error_data.get("message", f"Notion API returned HTTP {response.status_code}"),
                    "items": [],
                }

            data = response.json()
            results = data.get("results", [])

            items: List[Dict[str, Any]] = []
            for page in results:
                props = page.get("properties", {})
                title = extract_page_title(props)
                status = extract_page_status(props)
                script = extract_page_script(props)
                duration = extract_page_duration(props)
                tags = extract_page_tags(props)

                items.append({
                    "id": page.get("id"),
                    "title": title,
                    "status": status or "Unspecified",
                    "script": script,
                    "duration": duration,
                    "tags": tags,
                    "url": page.get("url"),
                    "last_edited_time": page.get("last_edited_time"),
                })

            return {
                "connected": True,
                "database_id": clean_db_id,
                "total": len(items),
                "items": items,
            }

    except Exception as e:
        logger.exception(f"Failed to fetch Notion database items: {e}")
        return {
            "connected": False,
            "error": str(e),
            "items": [],
        }


async def update_notion_page_status(
    page_id: str,
    new_status: str = "Rendered",
    download_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> bool:
    """
    Update a Notion page's status and optionally add video download URL/comment.
    """
    key = api_key or settings.NOTION_API_KEY
    if not key or not page_id:
        return False

    headers = get_notion_headers(key)
    
    try:
        # First retrieve page to check its property types
        async with httpx.AsyncClient(timeout=10.0) as client:
            get_res = await client.get(f"{NOTION_API_BASE}/pages/{page_id}", headers=headers)
            if get_res.status_code != 200:
                return False
            
            page_data = get_res.json()
            props = page_data.get("properties", {})

            # Determine matching property to update
            patch_props: Dict[str, Any] = {}
            for prop_name, prop_data in props.items():
                p_type = prop_data.get("type")
                lower_name = prop_name.lower()
                if p_type == "status":
                    patch_props[prop_name] = {"status": {"name": new_status}}
                    break
                elif p_type == "select" and "status" in lower_name:
                    patch_props[prop_name] = {"select": {"name": new_status}}
                    break

            if patch_props:
                patch_res = await client.patch(
                    f"{NOTION_API_BASE}/pages/{page_id}",
                    headers=headers,
                    json={"properties": patch_props}
                )
                logger.info(f"Updated Notion page {page_id} status: {patch_res.status_code}")

            # If download URL exists, create a comment on the Notion page
            if download_url:
                comment_payload = {
                    "parent": {"page_id": page_id},
                    "rich_text": [
                        {
                            "text": {
                                "content": f"🎬 ZenHub Video Rendered Successfully!\nDownload URL: {download_url}"
                            }
                        }
                    ]
                }
                await client.post(f"{NOTION_API_BASE}/comments", headers=headers, json=comment_payload)

            return True

    except Exception as e:
        logger.error(f"Error updating Notion page {page_id}: {e}")
        return False
