import { isFunction, isIterable, isNumber } from "#semantic/guard";
import { Epicycle } from "#semantic/mathematics/epicycle";
import { Tone } from "#semantic/mathematics/tone";
import { Waveform } from "#semantic/mathematics/waveform";
import { TrackEventSymbol, TrackSymbol } from "#semantic/symbol";

/**
 * A voice that a track event can place on the timeline.
 *
 * A source is a `Tone`, an `Epicycle`, a `Waveform` or a bare evaluator function
 * mapping a local time in seconds to a finite value. A tone already produces a
 * real sample; an epicycle or a waveform produces a complex exponential, so the
 * track takes its real part. The function form is called directly and must
 * return a finite number.
 */
export type TrackSource = Tone | Epicycle | Waveform | ((time: number) => number);

const evaluate: (source: TrackSource, time: number) => number = (source: TrackSource, time: number): number => {
    if (source instanceof Tone) {
        return source.value(time);
    }
    if (source instanceof Epicycle) {
        return source.value(time).getReal();
    }
    if (source instanceof Waveform) {
        return source.value(time).getReal();
    }
    if (isFunction(source)) {
        const value: unknown = source(time);
        if (!isNumber(value)) {
            throw new RangeError("Track source must return a finite value.");
        }
        return value;
    }
    throw new TypeError("Track source must be a Tone, an Epicycle, a Waveform or an evaluator function.");
}

/**
 * One placement of a voice on a track timeline.
 *
 * The event is active on the half-open interval `[start, start + duration)`, so
 * the start instant is included and the end instant is excluded. A duration of
 * `Infinity` keeps the event active from its start onwards without an end. The
 * source is evaluated in its own local time, that is, `time - start`, and its
 * value is multiplied by a constant linear gain.
 *
 * Events are immutable and may overlap freely, because a `Track` sums their
 * contributions rather than mixing them in place.
 */
export class TrackEvent {

    private readonly source: TrackSource;
    private readonly start: number;
    private readonly duration: number;
    private readonly gain: number;
    protected readonly [TrackEventSymbol]: symbol = TrackEventSymbol;

    /**
     * Creates a timeline event around a voice.
     *
     * The duration defaults to `Infinity`, meaning an open-ended event, and the
     * gain defaults to one, which leaves the voice unscaled. A finite duration
     * that is zero or negative is rejected rather than treated as silent.
     *
     * @param source the voice placed by this event
     * @param start the absolute start time in seconds
     * @param duration the active length in seconds, or `Infinity`;
     *        defaults to `Infinity`
     * @param gain the linear gain applied to the voice; defaults to one
     * @throws {TypeError} if the start or gain is not finite, the duration is not
     *         a finite number or `Infinity`, or the source is not a voice
     * @throws {RangeError} if the duration is zero or negative
     */
    public constructor(source: TrackSource, start: number, duration: number = Number.POSITIVE_INFINITY, gain: number = 1) {
        if (!isNumber(start)) {
            throw new TypeError("Track event start must be a finite number of seconds.");
        }
        if (duration !== Number.POSITIVE_INFINITY) {
            if (!isNumber(duration)) {
                throw new TypeError("Track event duration must be a positive number or Infinity.");
            }
            if (duration <= 0) {
                throw new RangeError("Track event duration must be positive.");
            }
        }
        if (!isNumber(gain)) {
            throw new TypeError("Track event gain must be a finite number.");
        }
        if (!(source instanceof Tone) && !(source instanceof Epicycle) && !(source instanceof Waveform) && !isFunction(source)) {
            throw new TypeError("Track event source must be a Tone, an Epicycle, a Waveform or an evaluator function.");
        }
        this.source = source;
        this.start = start;
        this.duration = duration;
        this.gain = gain;
    }

    /**
     * Returns the voice placed by this event.
     *
     * The source is shared rather than copied, so the returned instance is the
     * one supplied at construction.
     *
     * @returns the source of this event
     */
    public getSource(): TrackSource {
        return this.source;
    }

    /**
     * Returns the absolute start time of this event.
     *
     * The start is inclusive and is measured in seconds from the beginning of the
     * timeline.
     *
     * @returns the absolute start time in seconds
     */
    public getStart(): number {
        return this.start;
    }

    /**
     * Returns the active length of this event.
     *
     * An open-ended event reports `Infinity`, which keeps it active for every
     * later time.
     *
     * @returns the active length in seconds, possibly `Infinity`
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Returns the linear gain applied to the voice.
     *
     * The gain scales the evaluated contribution and defaults to one, so a gain
     * of zero silences the event without changing its window.
     *
     * @returns the linear gain
     */
    public getGain(): number {
        return this.gain;
    }

    /**
     * Returns the absolute end time of this event.
     *
     * The end is exclusive and follows from the start plus the duration, so an
     * open-ended event ends at `Infinity`.
     *
     * @returns the absolute end time in seconds, possibly `Infinity`
     */
    public getEnd(): number {
        return this.start + this.duration;
    }

    /**
     * Reports whether this event covers a point in time.
     *
     * The interval is half-open, so the start instant is active and the end
     * instant is not. An open-ended event is active at every time from its start
     * onwards.
     *
     * @param time the finite time in seconds to test
     * @returns `true` if the event is active at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public isActive(time: number): boolean {
        if (!isNumber(time)) {
            throw new TypeError("Track event time must be a finite number of seconds.");
        }
        return time >= this.start && time < this.start + this.duration;
    }

    /**
     * Evaluates the gained contribution of this event at a point in time.
     *
     * A time outside the active interval yields zero without evaluating the
     * source, so the source is never called with a local time outside its window.
     * Inside the window the source is sampled at `time - start` and the result is
     * multiplied by the gain.
     *
     * @param time the finite time in seconds at which to evaluate this event
     * @returns the gained contribution, or zero when the event is not active
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the source or the gained value is not finite
     */
    public value(time: number): number {
        if (!this.isActive(time)) {
            return 0;
        }
        const value: number = this.gain * evaluate(this.source, time - this.start);
        if (!isNumber(value)) {
            throw new RangeError("Track event value must be finite.");
        }
        return value;
    }

    /**
     * Renders the event window and gain for debugging.
     *
     * The source is represented by its own rendering, so two events are
     * distinguishable only by their window and gain.
     *
     * @returns a description containing the start, duration and gain
     */
    public toString(): string {
        return `TrackEvent(${this.start}s + ${this.duration}s, gain ${this.gain})`;
    }
}

/**
 * A polyphonic timeline of voices with per-event gain and an overall gain.
 *
 * Events are kept sorted by start time and may overlap, so the track sums every
 * active contribution, applies its own gain and exposes one continuous value per
 * point in time. The sort is stable, so events that start at the same instant
 * keep their insertion order, though summation makes that order invisible.
 *
 * The track duration is the greatest event end, or zero when there are no events.
 * A `Sampler` can render the value into frames on a single `Sample` plan.
 */
export class Track {

    private readonly events: ReadonlyArray<TrackEvent>;
    private readonly gain: number;
    protected readonly [TrackSymbol]: symbol = TrackSymbol;

    public constructor();
    public constructor(events: Iterable<TrackEvent>);
    public constructor(events: Iterable<TrackEvent>, gain: number);
    /**
     * Creates a track from an iterable of events and an overall gain.
     *
     * The events are copied, sorted by start time and frozen, so later changes to
     * the source iterable do not affect this track. An omitted iterable creates an
     * empty track and an omitted gain leaves contributions unscaled.
     *
     * @param events the events to place on the timeline; defaults to none
     * @param gain the overall linear gain; defaults to one
     * @throws {TypeError} if the gain is not a finite number or the argument is
     *         not an iterable of events
     */
    public constructor(events: Iterable<TrackEvent> = [], gain: number = 1) {
        if (!isNumber(gain)) {
            throw new TypeError("Track gain must be a finite number.");
        }
        if (!isIterable(events)) {
            throw new TypeError("Track expects an iterable of events.");
        }
        const collected: Array<TrackEvent> = [];
        for (const event of events) {
            if (!(event instanceof TrackEvent)) {
                throw new TypeError("Track iterable must contain only track events.");
            }
            collected.push(event);
        }
        collected.sort((left: TrackEvent, right: TrackEvent): number => left.getStart() - right.getStart());
        this.events = Object.freeze(collected);
        this.gain = gain;
    }

    /**
     * Returns the events of this track.
     *
     * The array is frozen, so it cannot be reordered or extended in place.
     *
     * @returns the events in start-time order
     */
    public getEvents(): ReadonlyArray<TrackEvent> {
        return this.events;
    }

    /**
     * Returns the overall linear gain of this track.
     *
     * The gain multiplies the sum of the active contributions, so it applies once
     * per evaluation rather than once per event.
     *
     * @returns the overall linear gain
     */
    public getGain(): number {
        return this.gain;
    }

    /**
     * Returns the number of events.
     *
     * @returns the event count, zero for an empty track
     */
    public size(): number {
        return this.events.length;
    }

    /**
     * Reports whether this track has no events.
     *
     * An empty track evaluates to zero at every time and lasts zero seconds.
     *
     * @returns `true` if there are no events
     */
    public isEmpty(): boolean {
        return this.events.length === 0;
    }

    /**
     * Returns a new track with one more event appended.
     *
     * The receiver is unchanged; the returned track re-sorts its events, so an
     * event starting before existing ones is placed accordingly. The overall gain
     * is preserved.
     *
     * @param event the event added to this track
     * @returns a new track containing the extra event
     * @throws {TypeError} if the value is not a track event
     */
    public append(event: TrackEvent): Track {
        return new Track([...this.events, event], this.gain);
    }

    /**
     * Returns a copy of this track with another overall gain.
     *
     * The events are shared with the receiver rather than copied.
     *
     * @param gain the replacement overall linear gain
     * @returns a new track carrying the supplied gain
     * @throws {TypeError} if the gain is not a finite number
     */
    public withGain(gain: number): Track {
        return new Track(this.events, gain);
    }

    /**
     * Evaluates the summed gained contribution of every active event.
     *
     * Events are summed in start-time order and the total is scaled by the overall
     * gain, so overlapping events add together and inactive ones contribute zero.
     * The cost is linear in the event count.
     *
     * @param time the finite time in seconds at which to evaluate this track
     * @returns the scaled sum of the active contributions
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the accumulated value is not finite
     */
    public value(time: number): number {
        if (!isNumber(time)) {
            throw new TypeError("Track time must be a finite number of seconds.");
        }
        let total: number = 0;
        for (const event of this.events) {
            total += event.value(time);
        }
        total *= this.gain;
        if (!isNumber(total)) {
            throw new RangeError("Track value must be finite.");
        }
        return total;
    }

    /**
     * Evaluates the summed gained contribution of every active event.
     *
     * This is an alias for `value`, kept for symmetry with the other timeline
     * types, and it rejects the same non-finite times.
     *
     * @param time the finite time in seconds at which to evaluate this track
     * @returns the scaled sum of the active contributions
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the accumulated value is not finite
     */
    public at(time: number): number {
        return this.value(time);
    }

    /**
     * Returns the end of the last event.
     *
     * The result is the greatest event end, so it is `Infinity` when any event is
     * open-ended. An empty track reports zero seconds even though it has no
     * events to bound.
     *
     * @returns the end time in seconds, possibly `Infinity`, or zero when empty
     */
    public getDuration(): number {
        let end: number = 0;
        for (const event of this.events) {
            end = Math.max(end, event.getEnd());
        }
        return end;
    }

    /**
     * Renders the event count and overall gain for debugging.
     *
     * The events themselves are omitted, so two tracks are distinguishable only
     * by their count and gain.
     *
     * @returns a description containing the number of events and the gain
     */
    public toString(): string {
        return `Track(${this.events.length} events, gain ${this.gain})`;
    }
}

export { isTrack, isTrackEvent } from "#semantic/guard";
