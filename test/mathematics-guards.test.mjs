import test from 'node:test';
import assert from 'node:assert/strict';
import { Angle, useRadian } from '../dist/mathematics/angle.js';
import { Complex } from '../dist/mathematics/complex.js';
import { Envelope } from '../dist/mathematics/envelope.js';
import { Epicycle } from '../dist/mathematics/epicycle.js';
import { Frequency } from '../dist/mathematics/frequency.js';
import { Omega } from '../dist/mathematics/omega.js';
import { Sample } from '../dist/mathematics/sample.js';
import { Sampler } from '../dist/mathematics/sampler.js';
import { Spectrum } from '../dist/mathematics/spectrum.js';
import { Tone } from '../dist/mathematics/tone.js';
import { Track, TrackEvent } from '../dist/mathematics/track.js';
import { Waveform } from '../dist/mathematics/waveform.js';
import {
    isAngle, isComplex, isEnvelope, isEpicycle, isFrequency, isOmega,
    isSample, isSampler, isSpectrum, isTone, isTrack, isTrackEvent, isWaveform,
} from '../dist/guard.js';

const plan = new Sample(2, 1);

const cases = [
    ['Angle', new Angle(), isAngle],
    ['Complex', new Complex(), isComplex],
    ['Envelope', new Envelope(1), isEnvelope],
    ['Epicycle', new Epicycle(new Envelope(1), new Omega(useRadian(1), 1), useRadian(0)), isEpicycle],
    ['Frequency', new Frequency(1), isFrequency],
    ['Omega', new Omega(useRadian(1), 1), isOmega],
    ['Sample', plan, isSample],
    ['Sampler', new Sampler(plan), isSampler],
    ['Spectrum', new Spectrum(plan, [new Complex(0, 0), new Complex(1, 0)]), isSpectrum],
    ['Tone', new Tone(new Frequency(1)), isTone],
    ['Track', new Track(), isTrack],
    ['TrackEvent', new TrackEvent(() => 0, 0), isTrackEvent],
    ['Waveform', new Waveform(), isWaveform],
];

test('every mathematics class advertises exactly its registered brand', () => {
    for (const [name, instance, guard] of cases) {
        assert.equal(guard(instance), true, `${name} is recognised by its guard`);
        for (const [otherName, , otherGuard] of cases) {
            if (otherGuard === guard) continue;
            assert.equal(otherGuard(instance), false, `${name} is not ${otherName}`);
        }
    }
});

test('mathematics guards reject untagged values', () => {
    for (const [name, , guard] of cases) {
        assert.equal(guard({}), false, `${name} guard rejects a plain object`);
        assert.equal(guard(null), false, `${name} guard rejects null`);
        assert.equal(guard(undefined), false, `${name} guard rejects undefined`);
        assert.equal(guard(1), false, `${name} guard rejects a primitive`);
    }
});
