"""Presets de timbre per a les veus cantades de Matxa, en funció del subgènere.

No es canvia la identitat de la veu amb IA: cada preset selecciona una de les veus
catalanes de Matxa i tracta l'àudio cantat amb filtres, saturació i ressonàncies.
El processament és local (NumPy/SciPy), sense peticions addicionals a cap API.
"""
from dataclasses import dataclass

import numpy as np
from scipy import signal


@dataclass(frozen=True)
class Timbre:
    name: str
    speaker: str
    highpass: int = 100
    lowpass: int = 8000
    body: float = 0.0
    nasal: float = 0.0
    presence: float = 0.0
    grit: float = 0.0
    slap_ms: int = 0
    slap_level: float = 0.0


# Un preset per als quinze subgèneres del motor. Diferenciem les veus de Matxa
# i el color de la mescla, però no estirem la veu fins que perdi intel·ligibilitat.
PRESETS = {
    'jamaican': Timbre('Ska jamaicà càlid', 'grau', 95, 8200, body=.24, presence=.10),
    'rocksteady': Timbre('Rocksteady vellutat', 'olga', 90, 6900, body=.38, presence=-.12, slap_ms=78, slap_level=.11),
    'twotone': Timbre('2 Tone nasal', 'pere', 120, 7700, nasal=.36, presence=.18, grit=.10),
    'nutty': Timbre('Nutty teatral', 'quim', 130, 8300, nasal=.31, presence=.28, grit=.13),
    'bossreggae': Timbre('Boss reggae de vinil', 'lluc', 100, 6000, body=.33, presence=-.08, grit=.08, slap_ms=100, slap_level=.12),
    'skaswing': Timbre('Ska-swing brillant', 'elia', 120, 9300, body=.14, presence=.38),
    'skapunk': Timbre('Ska-punk estrident', 'pere', 140, 8100, nasal=.27, presence=.35, grit=.30),
    'punk77': Timbre('Punk 77 cru', 'grau', 155, 7900, nasal=.16, presence=.40, grit=.38),
    'oi': Timbre('Oi! aspre i contundent', 'quim', 115, 6800, body=.32, presence=.15, grit=.48),
    'skatepunk': Timbre('Skate punk tens', 'lluc', 145, 8500, nasal=.12, presence=.41, grit=.28),
    'garage': Timbre('Garage lo-fi', 'grau', 170, 5300, body=.13, nasal=.20, presence=.18, grit=.55, slap_ms=55, slap_level=.08),
    'postpunk': Timbre('Post-punk fosc', 'grau', 95, 5750, body=.40, presence=-.20, grit=.08, slap_ms=120, slap_level=.12),
    'hardcore': Timbre('Hardcore agressiu', 'pere', 180, 7200, nasal=.15, presence=.36, grit=.65),
    'poppunk': Timbre('Pop-punk brillant', 'gina', 140, 9600, body=.08, presence=.38, grit=.09),
    'horrorpunk': Timbre('Horror punk espectral', 'quim', 100, 6200, body=.38, nasal=.14, presence=.12, grit=.34, slap_ms=145, slap_level=.18),
}
DEFAULT = Timbre('Matxa natural', 'grau')


def preset_for(subgenre):
    """Recupera un preset conegut, o una veu natural si és un subgènere nou."""
    return PRESETS.get(subgenre, DEFAULT)


def _band(x, lo, hi, rate):
    hi = min(hi, int(rate * .47))
    if lo >= hi:
        return np.zeros_like(x)
    return signal.sosfilt(signal.butter(2, [lo, hi], btype='bandpass',
                                           fs=rate, output='sos'), x)


def apply_timbre(samples, subgenre, rate=44100):
    """Aplica el color del subgènere sense canviar l'altura ni la durada del cant."""
    p = preset_for(subgenre)
    x = np.asarray(samples, dtype=np.float32)
    if x.ndim != 1:
        raise ValueError('La veu ha de ser mono')
    if not len(x):
        return x.copy()
    if not np.isfinite(x).all():
        raise ValueError('La veu conté valors no finits')
    if subgenre not in PRESETS:
        return x.copy()
    y = signal.sosfilt(signal.butter(2, [p.highpass, min(p.lowpass, int(rate * .47))],
                                     btype='bandpass', fs=rate, output='sos'), x.astype(np.float64))
    # Colors suaus: cos, nasalitat i presència. La via seca manté consonants clares.
    y += p.body * _band(x, 180, 650, rate)
    y += p.nasal * _band(x, 760, 1650, rate)
    y += p.presence * _band(x, 1750, 3900, rate)
    if p.grit:
        y = np.tanh(y * (1 + 5 * p.grit))
    if p.slap_ms and p.slap_level:
        delay = int(p.slap_ms * rate / 1000)
        if len(y) > delay:
            y[delay:] += p.slap_level * y[:-delay].copy()
    y = .88 * y + .12 * x  # protegeix la dicció després dels filtres forts
    # Mateix volum RMS aproximat abans i després; la mescla final s'encarrega del nivell.
    before = np.sqrt(np.mean(x.astype(np.float64) ** 2))
    after = np.sqrt(np.mean(y ** 2))
    if before > 1e-7 and after > 1e-7:
        y *= np.clip(before / after, .4, 2.5)
    return np.asarray(y, dtype=np.float32)
