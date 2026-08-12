import json, math, time, urllib.parse, urllib.request
from spots_base import SPOTS

# Final coordinate overrides after two Nominatim verification passes.
COORDS = {
    "Lough Ouler": (53.0596, -6.3738),
    "Lough Dan": (53.0780, -6.2660),
    "Glenmalure – Baravore": (52.9879, -6.4409),
    "Fraughan Rock Glen": (52.9826, -6.4358),
    "Upper Lough Bray": (53.1775, -6.3015),
    "Glensoulan Valley": (53.1550, -6.2450),
    "Cloghoge Valley (Lough Tay)": (53.0990, -6.2630),
    "Devil's Glen Woods": (53.0215, -6.1526),
    "Brittas Bay (south cove)": (52.8720, -6.0530),
    "Blessington Lakes – Baltyboys": (53.1471, -6.5363),
    "Djouce – White Hill saddle": (53.1250, -6.2440),
    "Lugnaquilla (Camarahill shoulder)": (52.9660, -6.4780),
    "Glenmacnass Valley": (53.0645, -6.3371),
    "Ventry Beach dunes": (52.1290, -10.3580),
    "Wine Strand, Smerwick Harbour": (52.1789, -10.3859),
    "Coumeenoole Beach": (52.1094, -10.4639),
    "Inch Beach dunes": (52.1350, -9.9850),
    "Great Blasket Island": (52.0990, -10.5300),
    "Derrynane dunes & Abbey Island": (51.7578, -10.1240),
    "Lamb's Head": (51.7404, -10.1319),
    "Ballinskelligs Beach": (51.8216, -10.2724),
    "Minard Castle": (52.1260, -10.1105),
    "Brandon Creek": (52.2680, -10.3230),
    "Mount Brandon (Faha side)": (52.2400, -10.2420),
    "Molls Gap": (51.9386, -9.6576),
    "Black Valley (Kerry Way)": (51.9800, -9.7600),
    "Allihies (Ballydonegan Bay)": (51.6350, -10.0500),
    "Castletownbere pier": (51.6514, -9.9105),
    "Beara Way – Dursey Sound": (51.6090, -10.1566),
    "Coumshingaun Lough": (52.2498, -7.5223),
    "Trá na mBó": (52.1341, -7.3763),
    "Ballyquin Beach": (51.9720, -7.7160),
    "Bunmahon dunes": (52.1399, -7.3709),
    "The Vee & Bay Lough": (52.2520, -7.9590),
    "Borheen Lough (Galtees)": (52.3726, -8.1516),
    "Lake Muskry (Galtees)": (52.3800, -8.1050),
    "Dog's Bay & Gurteen Bay": (53.3810, -9.9540),
    "Omey Island": (53.5309, -10.1629),
    "Gleninagh Valley (Twelve Bens)": (53.5080, -9.8300),
    "Lough Corrib shore (near Cong)": (53.5252, -9.3051),
    "Rinroe Beach, Carrowteige": (54.3230, -9.8260),
    "Keem Bay, Achill": (53.9670, -10.1902),
    "Wild Nephin – Letterkeen": (54.0110, -9.5894),
    "Silver Strand (Dooaghtry)": (53.6560, -9.9100),
    "Easkey Castle": (54.2890, -8.9630),
    "Mullaghmore Head": (54.4703, -8.4636),
    "Mullaghderg Beach": (55.0220, -8.4050),
    "Dunree Beach & Fort": (55.1963, -7.5541),
    "Silver Strand, Malin Beg": (54.6660, -8.7790),
    "Tramore Beach, Dunfanaghy": (55.1960, -7.9950),
    "Bluestack Mountains (Lough Eske side)": (54.7250, -8.0500),
    "Sliabh Liag (Slieve League)": (54.6517, -8.7072),
    "Blue Lough, Mournes": (54.1587, -5.9686),
    "Slieve Donard col": (54.1840, -5.9330),
    "Glenbarrow (Slieve Blooms)": (53.1221, -7.4520),
    "Barrow Way – St Mullins": (52.4910, -6.8964),
    "Lough Gill shore": (54.2501, -8.3708),
    "Mullagh Lough": (53.8115, -6.9486),
    "Baginbun Beach": (52.1768, -6.8300),
    "Hook Head": (52.1232, -6.9305),
    "Kilteery Pier": (52.5945, -9.2242),
    "Barleycove Beach dunes": (51.4695, -9.7765),
    "Three Castle Head": (51.4770, -9.8090),
    "Sheep's Head ridge (Seefin)": (51.5670, -9.6630),
    "Lough Hyne": (51.5007, -9.3009),
    "Gougane Barra": (51.8397, -9.3234),
    "Sherkin Island": (51.4716, -9.4175),
    "Inchydoney Beach": (51.5960, -8.8620),
    "Chimney Rock (Bloody Bridge)": (54.1700, -5.9050),
    "Annalong Wood": (54.1436, -5.9354),
    "Rostrevor Forest (Kodak Corner)": (54.1050, -6.1700),
    "Murlough Bay": (55.2110, -6.1350),
    "Benone Beach": (55.1750, -6.9150),
    "Lower Lough Erne (canoe trail)": (54.4670, -7.9065),
    "Sperrins – Sawel Mountain": (54.8210, -7.0370),
    "Lough Neagh – Ballyronan Wood": (54.7119, -6.5305),
    "Derrybeg dunes (Gweedore)": (55.0850, -8.3150),
}


import math

def hav_km(a, b, c, d):
    R = 6371.0
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(x))

def classify(tags):
    a = tags.get("amenity", ""); s = tags.get("shop", "")
    if a == "toilets": return "toilets"
    if a == "drinking_water": return "water"
    if a == "pub": return "pub"
    if a in ("cafe", "restaurant", "fast_food"): return "food"
    if s in ("supermarket", "convenience", "general"): return "shop"
    if a == "shower": return "shower"
    if a == "parking": return "parking"
    return None
