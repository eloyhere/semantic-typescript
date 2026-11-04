import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Envelope, Sample, Sampler, Tone, Track, TrackEvent, useHertz,
} from '../dist/index.js';

const close = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

test('track events gate their source window and gain', () => {
    const tone = new Tone(useHertz(1));
    const event = new TrackEvent(tone, 1, 0.5, 0.5);
    assert.equal(event.isActive(0.9), false);
    assert.equal(event.isActive(1), true);
    assert.equal(event.isActive(1.5), false);
    close(event.value(0.9), 0);
    close(event.value(1.25), 0.5 * tone.value(0.25));
    close(event.value(1.5), 0);
    assert.equal(event.getEnd(), 1.5);
});

test('track sums overlapping events in start order', () => {
    const tone = new Tone(useHertz(1));
    const track = new Track([
        new TrackEvent(tone, 0.5, 1, 0.5),
        new TrackEvent(tone, 0, 1),
    ]);
    assert.equal(track.size(), 2);
    assert.equal(track.getEvents()[0].getStart(), 0);
    close(track.value(0.75), tone.value(0.75) + 0.5 * tone.value(0.25));
    close(track.value(1.25), 0.5 * tone.value(0.75));
    close(track.getDuration(), 1.5);
    assert.equal(new Track().isEmpty(), true);
    assert.equal(new Track().getDuration(), 0);
});

test('track gain and append keep tracks immutable', () => {
    const tone = new Tone(useHertz(1));
    const track = new Track([new TrackEvent(tone, 0, 1)], 2);
    close(track.value(0.25), 2);
    const extended = track.append(new TrackEvent(tone, 2, 1));
    assert.equal(track.size(), 1);
    assert.equal(extended.size(), 2);
    close(extended.getDuration(), 3);
    close(track.withGain(0.5).value(0.25), 0.5);
    close(track.value(0.25), 2);
});

test('track evaluates function sources in event-local time', () => {
    const track = new Track([new TrackEvent((time) => time, 2, 3)]);
    close(track.value(2), 0);
    close(track.value(3), 1);
    close(track.value(4.5), 2.5);
});

test('track events validate windows, gains and sources', () => {
    const tone = new Tone(useHertz(1));
    assert.throws(() => new TrackEvent(tone, NaN), TypeError);
    assert.throws(() => new TrackEvent(tone, 0, 0), RangeError);
    assert.throws(() => new TrackEvent(tone, 0, -1), RangeError);
    assert.throws(() => new TrackEvent(tone, 0, 1, NaN), TypeError);
    assert.throws(() => new TrackEvent({}, 0), TypeError);
    assert.throws(() => new Track([{}]), TypeError);
    assert.throws(() => new Track(null), TypeError);
    assert.throws(() => new TrackEvent(() => NaN, 0).value(0), RangeError);
    assert.throws(() => new Track([new TrackEvent(tone, 0, 1)], NaN), TypeError);
    assert.throws(() => new TrackEvent(tone, 0).value(NaN), TypeError);
});

test('an infinite event keeps the track open ended', () => {
    const track = new Track([new TrackEvent(new Tone(useHertz(1)), 0)]);
    assert.equal(track.getDuration(), Infinity);
    assert.equal(track.getEvents()[0].isActive(1e9), true);
    close(track.value(0.25), 1);
});

test('sampler renders a track on a single sample plan', () => {
    const tone = new Tone(useHertz(440));
    const track = new Track([
        new TrackEvent(tone, 0, 0.002),
        new TrackEvent(tone.withEnvelope(new Envelope(0.5)), 0.001, 0.002),
    ]);
    const sampler = new Sampler(new Sample(4, 0.004));
    const frames = sampler.sample(track);
    assert.equal(frames.length, 4);
    frames.forEach((value, index) => close(value, track.value(sampler.getSample().getTime(index))));
    close(sampler.sampleAt(track, 1), track.value(0.001));
    assert.throws(() => sampler.sampleAt(track, 4), RangeError);
});
