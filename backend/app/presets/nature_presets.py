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
        "boat", "boats", "ship", "ships", "yacht", "vessel", "canoe", "kayak", "speedboat", "motorboat", "jetski", "sailing", "ferry",
        "dock", "docks", "pier", "piers", "marina", "harbor", "harbour", "port", "wharf", "jetty",
        "drone", "aerial", "overhead", "bird eye", "birds eye", "top down", "top-down", "satellite",
        "building", "house", "resort", "hotel", "cabin", "road", "car", "vehicle", "city", "bridge", "fence", "crowd", "traffic",
        "people", "person", "swimmer", "tourist", "tourists", "diver", "man", "woman", "human",
        "algae", "marsh", "swamp", "sludge", "scum", "murky", "muddy", "stagnant",
        "raw", "raw video", "log footage", "slog", "s-log", "flat profile", "ungraded", "uncolored", "flat color",
        "grey", "gray", "dull", "desaturated", "washed out", "drab", "monochrome", "lifeless", "faded",
        "gloomy", "dark", "overcast", "dreary", "depressing", "bleak",
        "foggy dark", "night", "shadowy", "animal", "bird",
        "storm", "lightning", "surfing", "timelapse", "hyperlapse", "fast movement",
        "text", "logo", "flashing", "neon"
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
        name="Sunlit Forest",
        icon="",
        category="Forest",
        description="Vibrant green woodland canopy, mossy forest paths, and bright daylight woodland",
        queries=[
            "lush green woodland canopy daylight",
            "peaceful green forest path daylight",
            "vibrant mossy forest daylight",
            "bright green woodland canopy",
            "peaceful woodland daylight",
            "lush green trees daylight calm"
        ],
        subthemes=["green canopy", "bright woodland path", "moss and ferns", "daylight forest"],
        preferred_colors=["vibrant green", "emerald", "leaf jade", "soft white"]
    ),
    "calm_ocean": EnvironmentTheme(
        id="calm_ocean",
        name="Calm Ocean",
        icon="",
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
        name="Wildflower Meadow",
        icon="",
        category="Meadow",
        description="Colorful blooming wildflowers swaying gently under bright blue skies",
        queries=[
            "bright wildflower meadow daylight",
            "blooming wildflower field sunny day",
            "gentle breeze colorful meadow daylight",
            "vibrant green pasture daylight",
            "lavender hills daylight",
            "bright wildflowers countryside sunny day"
        ],
        subthemes=["blooming wildflowers", "vibrant green grass", "bright meadow pasture", "lavender breeze"],
        preferred_colors=["vibrant yellow", "lavender", "soft pink", "fresh green"]
    ),
    "mountain_lake": EnvironmentTheme(
        id="mountain_lake",
        name="Mountain Lakes",
        icon="",
        category="Water",
        description="Placid mirror-like alpine lakes reflecting clear skies and pine ridges",
        queries=[
            "still alpine lake reflection daylight",
            "crystal clear mountain lake sunny day",
            "peaceful mountain lake shore daylight",
            "calm lake water daylight",
            "placid mountain lake blue sky"
        ],
        subthemes=["mirror lake reflection", "crystal alpine shore", "still water surface", "pine lake border"],
        preferred_colors=["sapphire blue", "pine green", "clear crystal", "soft white"]
    ),
    "golden_sunrise": EnvironmentTheme(
        id="golden_sunrise",
        name="Golden Sunrise",
        icon="",
        category="Sky",
        description="Bright morning daylight illuminating peaceful rolling hills and valleys",
        queries=[
            "bright morning daylight valley",
            "clear morning light nature hills",
            "peaceful morning daylight landscape",
            "vibrant morning light pasture",
            "bright daylight hill panorama"
        ],
        subthemes=["morning daylight mist", "clear morning light", "gentle rolling hills dawn", "bright valley horizon"],
        preferred_colors=["fresh gold", "soft amber", "morning blue", "honey yellow"]
    ),
    "lush_rainforest": EnvironmentTheme(
        id="lush_rainforest",
        name="Rainforest",
        icon="",
        category="Forest",
        description="Rich emerald tropical foliage, dew drops, and peaceful green canopies",
        queries=[
            "lush rainforest green canopy daylight",
            "dew drops tropical green leaves",
            "peaceful green jungle foliage daylight",
            "vibrant tropical rainforest daylight",
            "vibrant moss and tropical plants"
        ],
        subthemes=["tropical canopy", "dew on leaves", "vibrant moss and palms", "bright jungle light"],
        preferred_colors=["deep emerald", "vibrant moss", "vibrant jade", "leaf green"]
    ),
    "cascading_waterfalls": EnvironmentTheme(
        id="cascading_waterfalls",
        name="Waterfalls",
        icon="",
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
        name="Grasslands",
        icon="",
        category="Meadow",
        description="Endless fields of vibrant green and golden tall grass swaying in the breeze",
        queries=[
            "lush green grassland swaying breeze daylight",
            "green grass rolling hills daylight",
            "peaceful pastoral grassland daylight",
            "open green rolling hills daylight",
            "pastoral meadow breeze sunny day"
        ],
        subthemes=["swaying tall grass", "green rolling hills", "pastoral breeze", "open field horizon"],
        preferred_colors=["fresh green", "wheat amber", "soft green", "golden pasture"]
    ),
    "bamboo_groves": EnvironmentTheme(
        id="bamboo_groves",
        name="Bamboo",
        icon="",
        category="Zen",
        description="Tall green bamboo stalks swaying gracefully with zen stone gardens",
        queries=[
            "bright green bamboo forest daylight",
            "gentle swaying bamboo stalks",
            "peaceful zen bamboo grove daylight",
            "tranquil moss stone garden daylight",
            "bright green bamboo nature daylight"
        ],
        subthemes=["swaying bamboo stalks", "zen stone garden", "sunlit bamboo canopy", "moss and bamboo"],
        preferred_colors=["bamboo green", "warm gold", "soft jade", "river stone grey"]
    ),
    "cherry_blossoms": EnvironmentTheme(
        id="cherry_blossoms",
        name="Cherry Blossoms",
        icon="",
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
        name="Sandy Beach",
        icon="",
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
        name="Clouds",
        icon="",
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
        name="Autumn Woods",
        icon="",
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
        name="Desert Dunes",
        icon="",
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
        name="Lotus Ponds",
        icon="",
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
        name="Alpine Valleys",
        icon="",
        category="Mountain",
        description="Bright alpine meadows framed by majestic pine ridges and open skies",
        queries=[
            "bright alpine valley green meadow daylight",
            "peaceful mountain valley pines daylight",
            "green alpine meadow mountain view daylight",
            "green pine ridge valley landscape daylight",
            "alpine countryside bright sunny day"
        ],
        subthemes=["alpine green valley", "pine mountain ridge", "mountain pasture daylight", "highland meadow"],
        preferred_colors=["alpine green", "pine emerald", "sky blue", "snow white"]
    ),
    "tropical_lagoons": EnvironmentTheme(
        id="tropical_lagoons",
        name="Tropical Lagoons",
        icon="",
        category="Water",
        description="Swaying palm fronds and crystal clear emerald lagoons under bright blue skies",
        queries=[
            "crystal clear shallow tropical water ripples",
            "crystal clear turquoise lagoon water daylight",
            "pure tropical nature shore turquoise water",
            "empty tropical beach clear turquoise water daylight",
            "gentle shallow sea ripples turquoise daylight"
        ],
        subthemes=["swaying palm fronds", "crystal lagoon", "turquoise shallows", "tropical island shore"],
        preferred_colors=["lagoon turquoise", "palm green", "bright coral", "clear water"]
    ),
    "riverbed_pebbles": EnvironmentTheme(
        id="riverbed_pebbles",
        name="Riverbed",
        icon="",
        category="Water",
        description="Shallow crystal clear water gliding over smooth colorful river stones in daylight",
        queries=[
            "clear water smooth river stones daylight",
            "crystal clear riverbed pebbles daylight",
            "gentle shallow river clear water daylight",
            "peaceful stream smooth rocks daylight",
            "crystal water flowing riverbed daylight"
        ],
        subthemes=["smooth river stones", "crystal shallow stream", "clear pebble ripples", "calm riverbed"],
        preferred_colors=["clear water", "river stone amber", "slate blue", "golden pebble"]
    ),
    "sunset_twilight": EnvironmentTheme(
        id="sunset_twilight",
        name="Sunset Twilight",
        icon="",
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
        name="Fern Canyon",
        icon="",
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
    "starry_night": EnvironmentTheme(
        id="starry_night",
        name="Starry Night Sky",
        icon="",
        category="Night",
        description="Peaceful clear night skies, calm twinkling stars, and deep serene cosmos",
        queries=[
            "peaceful starry night sky stars",
            "calm clear starry night horizon",
            "gentle night sky stars nature",
            "still night sky peaceful stars",
            "tranquil starry night landscape"
        ],
        subthemes=["starry night sky", "gentle stars", "peaceful cosmic sky", "clear night horizon"],
        preferred_colors=["midnight blue", "deep indigo", "starlight gold", "soft silver"]
    ),
    "moonlit_water": EnvironmentTheme(
        id="moonlit_water",
        name="Moonlit Calm Waters",
        icon="",
        category="Night",
        description="Gentle silver moonlight reflecting on placid lakes and calm dark ocean waters",
        queries=[
            "calm water moonlight reflection",
            "peaceful moonlit lake still water",
            "gentle moon reflection ocean calm",
            "still night lake water calm",
            "serene moonlit ocean ripples"
        ],
        subthemes=["moonlight on water", "calm moonlit lake", "silver water reflection", "serene night ocean"],
        preferred_colors=["silver white", "deep navy", "moonlit pearl", "ocean indigo"]
    ),
    "night_forest": EnvironmentTheme(
        id="night_forest",
        name="Night Forest Stillness",
        icon="",
        category="Night",
        description="Serene pine trees silhouetted against deep starry night skies and peaceful dusk",
        queries=[
            "peaceful night forest trees stars",
            "calm pine trees night sky",
            "serene twilight forest calm",
            "quiet night woods stars landscape",
            "peaceful dark forest canopy stars"
        ],
        subthemes=["night pine silhouette", "forest night sky", "peaceful night woods", "twilight forest"],
        preferred_colors=["pine shadow", "midnight indigo", "soft starlight", "deep forest blue"]
    ),
}

WILDLIFE_ENVIRONMENTS: Dict[str, EnvironmentTheme] = {
    "savanna_predators": EnvironmentTheme(
        id="savanna_predators",
        name="Savanna & Big Cats",
        icon="🦁",
        category="Savanna",
        description="Majestic lions, cheetahs, leopards, elephant herds, and zebras across the golden African savanna",
        queries=[
            "lion pride african savanna wildlife 4k",
            "cheetah hunting golden grassland wildlife",
            "african elephant herd watering hole 4k",
            "leopard tree resting savanna wildlife",
            "zebras wildebeest great migration savanna"
        ],
        subthemes=["lion pride", "cheetah running", "elephant herd", "leopard in tree", "zebra migration"],
        preferred_colors=["golden amber", "savanna ochre", "warm earth", "acacia green"]
    ),
    "marine_giants": EnvironmentTheme(
        id="marine_giants",
        name="Ocean & Marine Giants",
        icon="🐋",
        category="Ocean",
        description="Majestic humpback whales, orcas, gentle sea turtles, dolphins, and vibrant coral reef life",
        queries=[
            "humpback whale swimming underwater 4k",
            "sea turtle swimming coral reef clear water",
            "orca pod swimming ocean wildlife",
            "dolphins swimming clear ocean 4k",
            "manta ray gliding underwater ocean"
        ],
        subthemes=["humpback whale", "sea turtle", "orca pod", "dolphin pod", "manta ray gliding"],
        preferred_colors=["deep oceanic blue", "vibrant turquoise", "coral orange", "seafoam"]
    ),
    "jungle_rainforest": EnvironmentTheme(
        id="jungle_rainforest",
        name="Jungle & Rainforest Wildlife",
        icon="🐆",
        category="Jungle",
        description="Stealthy jaguars, playful monkeys, colorful toucans, scarlet macaws, and exotic tree frogs",
        queries=[
            "jaguar wild rainforest amazon 4k",
            "monkeys playing tropical rainforest trees",
            "colorful toucan perched jungle branch",
            "scarlet macaw flying rainforest canopy",
            "tree frog tropical jungle leaves 4k"
        ],
        subthemes=["jaguar prowling", "rainforest primates", "tropical toucan", "macaws in flight", "tree frog macro"],
        preferred_colors=["emerald jungle", "jaguar gold", "scarlet red", "vibrant yellow"]
    ),
    "arctic_wildlife": EnvironmentTheme(
        id="arctic_wildlife",
        name="Arctic & Polar Wildlife",
        icon="🐻‍❄️",
        category="Polar",
        description="Mighty polar bears on sea ice, emperor penguin colonies, arctic foxes, and walruses",
        queries=[
            "polar bear walking arctic ice snow 4k",
            "emperor penguins antarctica ice colony",
            "arctic fox snow winter wildlife 4k",
            "walrus herd arctic ice shore wildlife",
            "seals resting arctic snow ice 4k"
        ],
        subthemes=["polar bear roaming", "emperor penguins", "arctic fox in snow", "walrus colony", "ice seals"],
        preferred_colors=["pure white", "glacier ice blue", "polar grey", "slate navy"]
    ),
    "sky_predators": EnvironmentTheme(
        id="sky_predators",
        name="Birds of Prey & Sky",
        icon="🦅",
        category="Birds",
        description="Majestic bald eagles soaring over mountains, golden hawks, snowy owls, and peregrine falcons",
        queries=[
            "bald eagle soaring mountain sky 4k",
            "snowy owl perched winter branch looking",
            "golden hawk flying wilderness 4k",
            "peregrine falcon perched rock cliff wildlife",
            "osprey fishing clear water lake 4k"
        ],
        subthemes=["bald eagle flight", "snowy owl gaze", "golden hawk", "peregrine falcon", "osprey hunting"],
        preferred_colors=["sky azure", "feather amber", "mountain white", "cloud grey"]
    ),
    "mountain_predators": EnvironmentTheme(
        id="mountain_predators",
        name="Mountain & Woodland Predators",
        icon="🐺",
        category="Mountain",
        description="Grizzly bears catching salmon, timber wolves prowling, elk herds, and bighorn sheep",
        queries=[
            "grizzly bear river fishing salmon 4k",
            "wolf pack forest winter wildlife 4k",
            "majestic bull elk mountain meadow forest",
            "bighorn sheep rocky mountain ridge 4k",
            "mountain cougar puma rocks wilderness"
        ],
        subthemes=["grizzly bear", "wolf pack", "bull elk antler", "bighorn sheep", "mountain cougar"],
        preferred_colors=["timber brown", "pine forest green", "rock slate", "winter white"]
    ),
    "wetland_wildlife": EnvironmentTheme(
        id="wetland_wildlife",
        name="River & Wetland Wildlife",
        icon="🦩",
        category="Wetland",
        description="Playful river otters, sunbathing crocodiles, majestic pink flamingos, and great blue herons",
        queries=[
            "river otters swimming playing clear river 4k",
            "pink flamingos shallow water lagoon wildlife",
            "crocodile sunbathing river bank wildlife",
            "great blue heron standing shallow water 4k",
            "kingfisher diving catching fish river"
        ],
        subthemes=["river otters", "flamingo flock", "crocodile basking", "heron wading", "kingfisher dive"],
        preferred_colors=["flamingo pink", "water sapphire", "river reed green", "earth clay"]
    ),
    "macro_insects": EnvironmentTheme(
        id="macro_insects",
        name="Macro Wildlife & Insects",
        icon="🦋",
        category="Macro",
        description="Vibrant monarch butterflies, praying mantis, color-shifting chameleons, and honeybees",
        queries=[
            "monarch butterfly flower close up macro 4k",
            "chameleon moving branch eyes macro wildlife",
            "praying mantis green leaf close up macro",
            "honeybee collecting pollen blooming flower 4k",
            "colorful caterpillar leaf macro wildlife"
        ],
        subthemes=["monarch butterfly", "chameleon on branch", "praying mantis", "honeybee pollination", "macro caterpillar"],
        preferred_colors=["monarch orange", "leaf lime green", "flower petal pink", "pollen gold"]
    ),
}

# Compatibility dictionary for preset lookups by id and legacy names
NATURE_PRESETS: Dict[str, EnvironmentTheme] = {}
for k, v in NATURE_ENVIRONMENTS.items():
    NATURE_PRESETS[k] = v
    NATURE_PRESETS[v.name] = v

for k, v in WILDLIFE_ENVIRONMENTS.items():
    NATURE_PRESETS[k] = v
    NATURE_PRESETS[v.name] = v

# Legacy aliases
if "sunlit_forest" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Calm Misty Forest"] = NATURE_ENVIRONMENTS["sunlit_forest"]
if "calm_ocean" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Calm Ocean"] = NATURE_ENVIRONMENTS["calm_ocean"]
if "mountain_lake" in NATURE_ENVIRONMENTS:
    NATURE_PRESETS["Mountain Lake"] = NATURE_ENVIRONMENTS["mountain_lake"]


def get_presets_for_mode(mode: str = "meditation") -> Dict[str, EnvironmentTheme]:
    if mode == "documentary":
        return WILDLIFE_ENVIRONMENTS
    return NATURE_ENVIRONMENTS


