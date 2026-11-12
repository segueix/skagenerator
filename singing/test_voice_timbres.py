"""Proves dels timbres Matxa: cobertura, color audible, volum i seguretat."""
import unittest

import numpy as np

from voice_timbres import PRESETS, apply_timbre, preset_for
from matxa import VOICES


SUBGENRES = {
    'jamaican', 'rocksteady', 'twotone', 'nutty', 'bossreggae', 'skaswing',
    'skapunk', 'punk77', 'oi', 'skatepunk', 'garage', 'postpunk',
    'hardcore', 'poppunk', 'horrorpunk',
}


class TestVoiceTimbres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rate = 44100
        t = np.arange(rate // 5) / rate
        # Mostra amb harmònics, consonants aproximades i greus.
        cls.sample = (
            .12 * np.sin(2 * np.pi * 185 * t)
            + .08 * np.sin(2 * np.pi * 920 * t)
            + .06 * np.sin(2 * np.pi * 2600 * t)
        ).astype(np.float32)

    def test_un_preset_per_subgenere(self):
        self.assertEqual(set(PRESETS), SUBGENRES)
        self.assertEqual(len({p.name for p in PRESETS.values()}), len(PRESETS))
        self.assertTrue(all(p.speaker in VOICES for p in PRESETS.values()))

    def test_filtres_tenen_efecte_audible_sense_canviar_durada(self):
        x = self.sample
        rms = np.sqrt(np.mean(x ** 2))
        fingerprints = set()
        for key in PRESETS:
            y = apply_timbre(x, key)
            self.assertEqual(y.dtype, np.float32)
            self.assertEqual(len(y), len(x))
            self.assertTrue(np.isfinite(y).all(), key)
            self.assertGreater(np.sqrt(np.mean(y ** 2)), .4 * rms, key)
            self.assertLess(np.sqrt(np.mean(y ** 2)), 1.6 * rms, key)
            self.assertGreater(np.mean(np.abs(y - x)), .001, key)
            fingerprints.add(tuple(np.round(y[200:260:10], 4)))
        self.assertGreaterEqual(len(fingerprints), 12)

    def test_subgenere_desconegut_es_neutre(self):
        self.assertEqual(preset_for('altre').speaker, 'grau')
        np.testing.assert_array_equal(apply_timbre(self.sample, 'altre'), self.sample)

    def test_entrada_invalida(self):
        with self.assertRaises(ValueError):
            apply_timbre(np.zeros((2, 20), dtype='float32'), 'punk77')
        with self.assertRaises(ValueError):
            apply_timbre(np.array([np.nan], dtype='float32'), 'punk77')


if __name__ == '__main__':
    unittest.main()
