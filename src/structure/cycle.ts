import { isNumber } from "#semantic/guard";
import { Angle, useRadian } from "#semantic/mathematics/angle";
import { Complex, usePolar } from "#semantic/mathematics/complex";
import { Frequency, useHertz } from "#semantic/mathematics/frequency";
import { PhaseField } from "#semantic/mathematics/field";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { Optional } from "#semantic/optional";
import { createCollection, readCollection } from "#semantic/structure/collection";
import { AsynchronousList, SynchronousList } from "#semantic/structure/list";

/**
 * Full-turn magnitude in radians, that is, `2 * PI`.
 *
 * A ring position is turned into an angle by scaling its residue by this value,
 * and a radial frequency is turned into an angular rate the same way.
 */
const FullTurn: number = Math.PI * 2;

/**
 * The sampled view of one cycle element. A record is an immutable snapshot:
 * later list mutations do not change a record returned earlier.
 *
 * @template E the type of the stored element
 */
export interface CycleElement<E> {
    /** The element stored at the sampled position. */
    readonly element: E;
    /** The intrinsic phase of the sampled position. */
    readonly phase: Angle;
    /** The ambient rotation rate shared by the whole cycle. */
    readonly frequency: Frequency;
    /** The intrinsic phasor of the element at the sampled position. */
    readonly complex: Complex;
}

/**
 * The state of one element at an instant, taken relative to the environment.
 *
 * A view is a pure function of the position and the time, so the same pair
 * always yields the same record and nothing has to be stored between calls.
 * `phase` is the element's own phase after its intrinsic rate has advanced it,
 * while `relative` subtracts the angle the environment has advanced as well;
 * the relative phase is the coordinate a `PhaseField` is scored against.
 *
 * @template E the type of the stored element
 */
export interface CycleView<E> {
    /** The element stored at the sampled position. */
    readonly element: E;
    /** The position that produced this view. */
    readonly index: bigint;
    /** The instant, in seconds. */
    readonly time: number;
    /** The element's own phase at this instant. */
    readonly phase: Angle;
    /** The phase relative to the ambient environment. */
    readonly relative: Angle;
    /** The element's own cyclic rate, zero when it is a fixed marker. */
    readonly rate: Frequency;
    /** The element's phasor at this instant. */
    readonly complex: Complex;
}

/**
 * The differential state of one element at an instant.
 *
 * A jet reports the first derivative of the element's phase and the signed
 * difference between its own rate and the ambient rate. Because a rate is
 * constant per element, the second derivative is always zero and is not
 * reported.
 *
 * @template E the type of the stored element
 */
export interface CycleJet<E> {
    /** The element stored at the sampled position. */
    readonly element: E;
    /** The position that produced this jet. */
    readonly index: bigint;
    /** The instant, in seconds. */
    readonly time: number;
    /** The element's own phase at this instant. */
    readonly phase: Angle;
    /** The element's own cyclic rate, non-negative. */
    readonly rate: Frequency;
    /** The signed difference between the element's rate and the ambient rate, in hertz. */
    readonly slip: number;
}

/**
 * One observation from the data passed to `analyse`.
 *
 * A reading is only produced for an element the ring actually holds, so its
 * phase is the canonical phase of that element rather than a supplied value.
 *
 * @template E the type of the stored element
 */
export interface CycleReading<E> {
    /** The observed element. */
    readonly element: E;
    /** The ring position the element occupies. */
    readonly index: bigint;
    /** The intrinsic phase of that position. */
    readonly phase: Angle;
    /** The phase relative to the ambient environment at the analysed instant. */
    readonly relative: Angle;
}

/**
 * How the analysed data distributes around one reference element.
 *
 * The reference is a ring element and its intrinsic phase is the baseline every
 * observation is measured against, so a row answers "where does the data sit
 * when this element is taken as zero".
 *
 * @template E the type of the stored element
 */
export interface CycleReference<E> {
    /** The reference element. */
    readonly element: E;
    /** The ring position of the reference. */
    readonly index: bigint;
    /** How many observations landed exactly on this reference. */
    readonly count: number;
    /** Mean resultant length of the observations around this reference, in `[0, 1]`. */
    readonly resultant: number;
    /** Mean phase of the observations around this reference; empty when there are none. */
    readonly mean: Optional<Angle>;
}

/**
 * The result of analysing data against a cycle.
 *
 * Every ring element is a reference phase, and every observation is matched
 * back to the ring by identity. Observations whose element is absent are
 * counted as missed rather than guessed at, because the ring is the only source
 * of phases.
 *
 * @template E the type of the stored element
 */
export interface CycleAnalysis<E> {
    /** The number of elements in the ring. */
    readonly size: number;
    /** The number of observations supplied. */
    readonly total: number;
    /** The number of observations whose element the ring holds. */
    readonly matched: number;
    /** The number of observations whose element the ring does not hold. */
    readonly missed: number;
    /** One reading per matched observation, in the order supplied. */
    readonly readings: ReadonlyArray<CycleReading<E>>;
    /** One row per ring element, in ring order. */
    readonly references: ReadonlyArray<CycleReference<E>>;
}

/**
 * Construction options shared by both cycle modes.
 *
 * A cycle is an `n`-fold ring: the element count, the positional period and the
 * number of distinct phases are all the same integer `n`. Position `i` carries
 * the intrinsic phase `phase + span * 2*PI * (i mod n) / n`, computed from the
 * exact residue of `i` rather than from an accumulated floating-point product,
 * so `phaseAt(i)` and `phaseAt(i + n)` are exactly the same angle.
 *
 * `frequency` is the ambient rotation rate: it describes the environment the
 * ring is embedded in, not the phase step between positions. The environment
 * advances the phase of every element by the same amount, so it never changes
 * the intrinsic pattern and never breaks its balance.
 *
 * `span` is the number of full turns the ring occupies. The default of one turn
 * places the elements on the `n`-th roots of unity; a span that shares a factor
 * with `n` collapses positions onto a shorter orbit.
 *
 * @template E the type of stored elements
 */
export interface CycleOptions<E> {
    /** Phase at position zero; defaults to zero radians. */
    phase?: Angle;
    /** Ambient rotation rate shared by the whole ring; defaults to zero hertz. */
    frequency?: Frequency;
    /** Turns occupied by the ring, a positive finite number; defaults to one. */
    span?: number;
    /** Finite, non-negative phasor length per element; defaults to one. */
    magnitude?: (element: E, index: bigint) => number;
    /** Intrinsic rate of each element; defaults to zero, a fixed marker. */
    rate?: (element: E, index: bigint) => Frequency;
}

/**
 * A positional list stored as a circular doubly linked ring, sampled as an
 * `n`-fold phase ring.
 *
 * The head and tail nodes are connected: the successor of the tail is the head
 * and the predecessor of the head is the tail. The list stays finite, so
 * positional operations such as `get` and `removeAt` remain bounded, while the
 * sampling operations accept any position and wrap around the ring. A negative
 * position traverses the ring backwards.
 *
 * Because the phase is derived from the residue of the position, the ring is
 * exactly `n`-periodic: `phaseAt(i)` and `phaseAt(i + n)` are identical, and an
 * insertion or a removal re-spaces every element onto the new `n`-th roots of
 * unity. Balance therefore heals itself under structural change; only a
 * non-unit `magnitude` can keep a ring out of balance.
 *
 * @template E the type of elements in this cycle
 */
export interface AsynchronousCycle<E> extends AsynchronousList<E> {

    /** The phase at position zero. */
    getPhase(): Angle;

    /** The ambient rotation rate shared by every element. */
    getFrequency(): Frequency;

    /** The number of full turns the ring occupies. */
    getSpan(): number;

    /**
     * Returns the sampled view of the element at the specified position.
     *
     * @param index the cyclic position to sample
     * @returns a promise that resolves to the sampled element, or to an empty
     *          `Optional` if this cycle is empty
     */
    elementAt(index: bigint): Promise<Optional<CycleElement<E>>>;

    /**
     * Returns the ambient rotation rate.
     *
     * @param index the cyclic position to sample
     * @returns a promise that resolves to the shared rate, or to an empty
     *          `Optional` if this cycle is empty
     */
    frequencyAt(index: bigint): Promise<Optional<Frequency>>;

    /**
     * Returns the intrinsic phase of the specified position.
     *
     * @param index the cyclic position to sample
     * @returns a promise that resolves to the intrinsic phase, or to an empty
     *          `Optional` if this cycle is empty
     */
    phaseAt(index: bigint): Promise<Optional<Angle>>;

    /**
     * Returns the phase of a position relative to the ambient environment.
     *
     * The relative phase is the intrinsic phase minus the angle the environment
     * has advanced after `time` seconds, so it is the coordinate a `PhaseField`
     * is scored against.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns a promise that resolves to the relative phase, or to an empty
     *          `Optional` if this cycle is empty
     */
    relativeAt(index: bigint, time: number): Promise<Optional<Angle>>;

    /**
     * Returns the full state of one element at an instant.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns a promise that resolves to the view, or to an empty `Optional`
     *          if this cycle is empty
     */
    viewAt(index: bigint, time: number): Promise<Optional<CycleView<E>>>;

    /**
     * Returns the state of every element at an instant, in ring order.
     *
     * @param time the elapsed time in seconds
     * @returns a promise that resolves to one view per element
     */
    viewsAt(time: number): Promise<Array<CycleView<E>>>;

    /**
     * Returns the differential state of one element at an instant.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns a promise that resolves to the jet, or to an empty `Optional`
     *          if this cycle is empty
     */
    jetAt(index: bigint, time: number): Promise<Optional<CycleJet<E>>>;

    /**
     * Returns the whole turns an element has slipped relative to the environment.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns a promise that resolves to the truncated slip in turns, or to an
     *          empty `Optional` if this cycle is empty
     */
    windingAt(index: bigint, time: number): Promise<Optional<bigint>>;

    /**
     * Returns the accumulated phase error of one element.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @param origin the instant the accumulation starts, defaulting to zero
     * @returns a promise that resolves to the integral in turns times seconds,
     *          or to an empty `Optional` if this cycle is empty
     */
    errorIntegralAt(index: bigint, time: number, origin?: number): Promise<Optional<number>>;

    /**
     * Returns how concentrated the current phasors are.
     *
     * @param time the elapsed time in seconds, defaulting to zero
     * @returns a promise that resolves to the resultant length within `[0, 1]`,
     *          or to an empty `Optional` if this cycle is empty
     */
    resultant(time?: number): Promise<Optional<number>>;

    /**
     * Analyses target data with every element of the ring as a reference phase.
     *
     * Each observation is matched back to the ring, so its phase is the
     * canonical phase of the element rather than a value carried by the data.
     * Observations the ring does not hold are counted as missed and contribute
     * no reading, because the ring is the only source of phases.
     *
     * @param data the observations to analyse
     * @param time the elapsed time in seconds used for relative phases, defaulting to zero
     * @returns a promise that resolves to the analysis
     */
    analyse(data: Iterable<E>, time?: number): Promise<CycleAnalysis<E>>;

    /**
     * Returns the phasor of every element, in ring order.
     *
     * @returns a promise that resolves to the intrinsic phasors of this cycle
     */
    toComplex(): Promise<Array<Complex>>;

    /**
     * Returns the intrinsic phasor of the element at the specified position.
     *
     * @param index the cyclic position to sample
     * @returns a promise that resolves to the phasor, or to an empty `Optional`
     *          if this cycle is empty
     */
    toComplex(index: bigint): Promise<Optional<Complex>>;

    /**
     * Returns the mean phasor of the ring, which is its zero sequence.
     *
     * @returns a promise that resolves to the mean phasor, or to an empty
     *          `Optional` if this cycle is empty
     */
    zeroSequence(): Promise<Optional<Complex>>;

    /**
     * Returns the share of the ring's energy carried by the fundamental mode.
     *
     * The value is `abs(c1)^2 / (n * sum(abs(z)^2))` and equals one exactly
     * when the ring is balanced. It is zero for a ring of fewer than two
     * elements, or one without energy.
     *
     * @returns a promise that resolves to a value within `[0, 1]`
     */
    purity(): Promise<number>;

    /**
     * Returns the full symmetric-component decomposition of the ring.
     *
     * @returns a promise that resolves to the `n` sequence components, lowest
     *          order first
     */
    sequences(): Promise<Array<Complex>>;

    /**
     * Returns the spatial spectrum of the ring as a `Spectrum`.
     *
     * Bin `j` holds the `j`-th symmetric component and reports a rate of `j`
     * cycles per ring revolution, so the frequency axis is the wavenumber axis.
     * This is the spatial counterpart of `Spectrum`, which describes a temporal
     * signal.
     *
     * @returns a promise that resolves to the spectrum, or to an empty
     *          `Optional` if this cycle is empty
     */
    toSpectrum(): Promise<Optional<Spectrum>>;

    /**
     * Reports whether the ring carries a single balanced mode.
     *
     * @param epsilon the tolerance on the leaked energy, defaulting to `1E-9`
     * @returns a promise that resolves to `false` for a ring of fewer than two
     *          elements, and to the purity test otherwise
     */
    isBalanced(epsilon?: number): Promise<boolean>;

    /**
     * Scores one position against a bounded field.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @param field the field to sample with the relative phase
     * @returns a promise that resolves to the score within `[-1, 1]`, or to an
     *          empty `Optional` if this cycle is empty
     */
    scoreAt(index: bigint, time: number, field: PhaseField): Promise<Optional<number>>;

    /**
     * Scores every position at once, in ring order.
     *
     * @param time the elapsed time in seconds
     * @param field the field to sample with each relative phase
     * @returns a promise that resolves to one score per element
     */
    scoresAt(time: number, field: PhaseField): Promise<Array<number>>;
}

/**
 * A positional list stored as a circular doubly linked ring, sampled as an
 * `n`-fold phase ring.
 *
 * The head and tail nodes are connected: the successor of the tail is the head
 * and the predecessor of the head is the tail. The list stays finite, so
 * positional operations such as `get` and `removeAt` remain bounded, while the
 * sampling operations accept any position and wrap around the ring. A negative
 * position traverses the ring backwards.
 *
 * Because the phase is derived from the residue of the position, the ring is
 * exactly `n`-periodic: `phaseAt(i)` and `phaseAt(i + n)` are identical, and an
 * insertion or a removal re-spaces every element onto the new `n`-th roots of
 * unity. Balance therefore heals itself under structural change; only a
 * non-unit `magnitude` can keep a ring out of balance.
 *
 * @template E the type of elements in this cycle
 */
export interface SynchronousCycle<E> extends SynchronousList<E> {

    /** The phase at position zero. */
    getPhase(): Angle;

    /** The ambient rotation rate shared by every element. */
    getFrequency(): Frequency;

    /** The number of full turns the ring occupies. */
    getSpan(): number;

    /**
     * Returns the sampled view of the element at the specified position.
     *
     * @param index the cyclic position to sample
     * @returns the sampled element, or an empty `Optional` if this cycle is empty
     */
    elementAt(index: bigint): Optional<CycleElement<E>>;

    /**
     * Returns the ambient rotation rate.
     *
     * @param index the cyclic position to sample
     * @returns the shared rate, or an empty `Optional` if this cycle is empty
     */
    frequencyAt(index: bigint): Optional<Frequency>;

    /**
     * Returns the intrinsic phase of the specified position.
     *
     * @param index the cyclic position to sample
     * @returns the intrinsic phase, or an empty `Optional` if this cycle is empty
     */
    phaseAt(index: bigint): Optional<Angle>;

    /**
     * Returns the phase of a position relative to the ambient environment.
     *
     * The relative phase is the intrinsic phase minus the angle the environment
     * has advanced after `time` seconds, so it is the coordinate a `PhaseField`
     * is scored against.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns the relative phase, or an empty `Optional` if this cycle is empty
     */
    relativeAt(index: bigint, time: number): Optional<Angle>;

    /**
     * Returns the full state of one element at an instant.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns the view, or an empty `Optional` if this cycle is empty
     */
    viewAt(index: bigint, time: number): Optional<CycleView<E>>;

    /**
     * Returns the state of every element at an instant, in ring order.
     *
     * @param time the elapsed time in seconds
     * @returns one view per element
     */
    viewsAt(time: number): Array<CycleView<E>>;

    /**
     * Returns the differential state of one element at an instant.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns the jet, or an empty `Optional` if this cycle is empty
     */
    jetAt(index: bigint, time: number): Optional<CycleJet<E>>;

    /**
     * Returns the whole turns an element has slipped relative to the environment.
     *
     * The value is the slip in turns truncated toward zero, so it counts whole
     * turns only: an element half a turn ahead reports zero, one and a half
     * turns ahead reports one, and the sign follows the direction of travel.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @returns the truncated slip in turns, or an empty `Optional` if this cycle
     *          is empty
     */
    windingAt(index: bigint, time: number): Optional<bigint>;

    /**
     * Returns the accumulated phase error of one element.
     *
     * The value is the integral of the relative phase over the interval, in
     * turns times seconds. Note that the integral of the relative *rate* would
     * merely give back the relative phase, so this is the quantity that carries
     * new information about how long an element has been ahead or behind.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @param origin the instant the accumulation starts, defaulting to zero
     * @returns the integral in turns times seconds, or an empty `Optional` if
     *          this cycle is empty
     */
    errorIntegralAt(index: bigint, time: number, origin?: number): Optional<number>;

    /**
     * Returns how concentrated the current phasors are.
     *
     * The value is the magnitude of the phasor sum divided by the sum of the
     * magnitudes, so it is `0` for a balanced ring and approaches `1` as the
     * phasors bunch together. Unlike `purity`, which answers whether the ring is
     * still the `n`-th roots of unity, this is the mean resultant length: it
     * needs no transform and is the standard measure of phase concentration.
     *
     * Because the ambient rotation moves every phasor by the same angle, it
     * cannot change the resultant; only differing per-element rates can, so the
     * value starts at its intrinsic level and drifts as the ring de-phases.
     *
     * @param time the elapsed time in seconds, defaulting to zero
     * @returns the resultant length within `[0, 1]`, or an empty `Optional` if
     *          this cycle is empty
     */
    resultant(time?: number): Optional<number>;

    /**
     * Analyses target data with every element of the ring as a reference phase.
     *
     * Each observation is matched back to the ring, so its phase is the
     * canonical phase of the element rather than a value carried by the data.
     * Observations the ring does not hold are counted as missed and contribute
     * no reading, because the ring is the only source of phases.
     *
     * For a reference element `r` the row reports how many observations landed
     * exactly on `r`, the mean resultant length of every observation measured
     * around `r`, and the mean of those relative phases. A resultant of zero
     * means the data is spread evenly around the reference; one means it is
     * concentrated on a single relative phase.
     *
     * @param data the observations to analyse
     * @param time the elapsed time in seconds used for relative phases, defaulting to zero
     * @returns the analysis
     * @throws {TypeError} if the data is not iterable or the time is not finite
     */
    analyse(data: Iterable<E>, time?: number): CycleAnalysis<E>;

    /**
     * Returns the phasor of every element, in ring order.
     *
     * @returns the intrinsic phasors of this cycle
     */
    toComplex(): Array<Complex>;

    /**
     * Returns the intrinsic phasor of the element at the specified position.
     *
     * @param index the cyclic position to sample
     * @returns the phasor, or an empty `Optional` if this cycle is empty
     */
    toComplex(index: bigint): Optional<Complex>;

    /**
     * Returns the mean phasor of the ring, which is its zero sequence.
     *
     * @returns the mean phasor, or an empty `Optional` if this cycle is empty
     */
    zeroSequence(): Optional<Complex>;

    /**
     * Returns the share of the ring's energy carried by the fundamental mode.
     *
     * The value is `abs(c1)^2 / (n * sum(abs(z)^2))` and equals one exactly
     * when the ring is balanced. It is zero for a ring of fewer than two
     * elements, or one without energy.
     *
     * @returns a value within `[0, 1]`
     */
    purity(): number;

    /**
     * Returns the full symmetric-component decomposition of the ring.
     *
     * @returns the `n` sequence components, lowest order first
     */
    sequences(): Array<Complex>;

    /**
     * Returns the spatial spectrum of the ring as a `Spectrum`.
     *
     * Bin `j` holds the `j`-th symmetric component and reports a rate of `j`
     * cycles per ring revolution, so the frequency axis is the wavenumber axis.
     * This is the spatial counterpart of `Spectrum`, which describes a temporal
     * signal.
     *
     * The components are complex and in general **not conjugate-symmetric**: a
     * balanced ring puts all of its energy in bin one, while a ring whose
     * positions traverse the circle backwards puts it in bin `n - 1`. The
     * one-sided helpers of `Spectrum` (`oneSided`, `getNyquist`, `centroid`)
     * assume a real signal and are therefore only meaningful when the modes
     * appear in conjugate pairs; read the bins directly otherwise.
     *
     * @returns the spectrum, or an empty `Optional` if this cycle is empty
     */
    toSpectrum(): Optional<Spectrum>;

    /**
     * Reports whether the ring carries a single balanced mode.
     *
     * @param epsilon the tolerance on the leaked energy, defaulting to `1E-9`
     * @returns `false` for a ring of fewer than two elements, and the purity
     *          test otherwise
     */
    isBalanced(epsilon?: number): boolean;

    /**
     * Scores one position against a bounded field.
     *
     * @param index the cyclic position to sample
     * @param time the elapsed time in seconds
     * @param field the field to sample with the relative phase
     * @returns the score within `[-1, 1]`, or an empty `Optional` if this cycle
     *          is empty
     */
    scoreAt(index: bigint, time: number, field: PhaseField): Optional<number>;

    /**
     * Scores every position at once, in ring order.
     *
     * @param time the elapsed time in seconds
     * @param field the field to sample with each relative phase
     * @returns one score per element
     */
    scoresAt(time: number, field: PhaseField): Array<number>;
}

/** Creates an asynchronous cycle. Null and undefined elements are rejected. */
export interface AsynchronousCycleConstructor {
    new <E = unknown>(): AsynchronousCycle<E>;
    new <E>(source: Iterable<E>, options?: CycleOptions<E>): AsynchronousCycle<E>;
    new <E>(source: AsyncIterable<E>, options?: CycleOptions<E>): AsynchronousCycle<E>;
    new <E = unknown>(source: undefined, options: CycleOptions<E>): AsynchronousCycle<E>;
}

/** Creates a synchronous cycle. Null and undefined elements are rejected. */
export interface SynchronousCycleConstructor {
    new <E = unknown>(): SynchronousCycle<E>;
    new <E>(source: Iterable<E>, options?: CycleOptions<E>): SynchronousCycle<E>;
    new <E = unknown>(source: undefined, options: CycleOptions<E>): SynchronousCycle<E>;
}

/** One link of the ring. The head and tail references are connected in both directions. */
interface RingNode<E> {
    element: E;
    previous?: RingNode<E>;
    next?: RingNode<E>;
}

const requireIndex: (index: unknown) => bigint = (index: unknown): bigint => {
    if (typeof index !== "bigint") {
        throw new TypeError("Cycle index must be a bigint.");
    }
    return index;
}

const requirePhase: (phase: unknown) => Angle = (phase: unknown): Angle => {
    if (!(phase instanceof Angle)) {
        throw new TypeError("Cycle phase must be an Angle.");
    }
    return phase;
}

const requireFrequency: (frequency: unknown) => Frequency = (frequency: unknown): Frequency => {
    if (!(frequency instanceof Frequency)) {
        throw new TypeError("Cycle frequency must be a Frequency.");
    }
    return frequency;
}

const requireSpan: (span: unknown) => number = (span: unknown): number => {
    if (!isNumber(span)) {
        throw new TypeError("Cycle span must be a finite number of turns.");
    }
    if (span <= 0) {
        throw new RangeError("Cycle span must be positive.");
    }
    return span;
}

const requireFinite: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}

const requireField: (field: unknown) => PhaseField = (field: unknown): PhaseField => {
    if (!(field instanceof PhaseField)) {
        throw new TypeError("Cycle field must be a PhaseField.");
    }
    return field;
}

/**
 * Builds the shared implementation behind the named constructors.
 *
 * Elements live in a circular doubly linked ring whose head and tail are
 * joined. Every structural change splices the ring before it is committed, so
 * a failed insertion or replacement leaves both the list and its samples
 * unchanged. The phase of a position is a pure function of its residue and the
 * current ring length, so the ring is exactly periodic and its balance cannot
 * drift.
 */
function createCycleConstructor(name: string, asynchronous: boolean) {
    const constructor = function (
        this: object,
        source?: Iterable<unknown> | AsyncIterable<unknown>,
        options: CycleOptions<unknown> = {},
    ): object {
        if (!new.target) {
            throw new TypeError(`${name} must be constructed with new.`);
        }
        if (source === null) {
            throw new TypeError("Source must be iterable.");
        }
        const phase: Angle = requirePhase(options.phase ?? useRadian(0));
        const frequency: Frequency = requireFrequency(options.frequency ?? useHertz(0));
        const span: number = requireSpan(options.span ?? 1);
        const magnitude = options.magnitude ?? ((): number => 1);
        if (typeof magnitude !== "function") {
            throw new TypeError("Cycle magnitude must be a function.");
        }
        const rate = options.rate;
        if (rate !== undefined && typeof rate !== "function") {
            throw new TypeError("Cycle rate must be a function.");
        }
        const omega = frequency.toOmega();
        let head: RingNode<unknown> | undefined;
        let tail: RingNode<unknown> | undefined;
        let count = 0;
        /** Walks the ring once, verifying that the tail really joins the head. */
        const nodes = (): RingNode<unknown>[] => {
            const result: RingNode<unknown>[] = [];
            let current = head;
            for (let index = 0; index < count; index++) {
                if (!current) throw new TypeError("Cycle links are inconsistent.");
                result.push(current);
                current = current.next;
            }
            if (count > 0 && current !== head) throw new TypeError("Cycle is not closed.");
            return result;
        };
        const append = (element: unknown): boolean => {
            const node: RingNode<unknown> = { element };
            if (!head || !tail) {
                node.previous = node;
                node.next = node;
                head = node;
                tail = node;
            } else {
                node.previous = tail;
                node.next = head;
                tail.next = node;
                head.previous = node;
                tail = node;
            }
            count++;
            return true;
        };
        const insertAt = (index: number, element: unknown): boolean => {
            if (!head || !tail || index <= 0) {
                if (!head || !tail) return append(element);
                const node: RingNode<unknown> = { element, previous: tail, next: head };
                head.previous = node;
                tail.next = node;
                head = node;
                count++;
                return true;
            }
            if (index >= count) return append(element);
            let current: RingNode<unknown> = head;
            for (let step = 0; step < index; step++) current = current.next!;
            const node: RingNode<unknown> = { element, previous: current.previous, next: current };
            current.previous!.next = node;
            current.previous = node;
            count++;
            return true;
        };
        const removeAt = (index: number): unknown => {
            let current: RingNode<unknown> = head!;
            for (let step = 0; step < index; step++) current = current.next!;
            if (count === 1) {
                head = undefined;
                tail = undefined;
                count = 0;
                return current.element;
            }
            current.previous!.next = current.next;
            current.next!.previous = current.previous;
            if (current === head) head = current.next;
            if (current === tail) tail = current.previous;
            count--;
            return current.element;
        };
        const replaceAll = (values: readonly unknown[]): boolean => {
            head = undefined;
            tail = undefined;
            count = 0;
            for (const value of values) append(value);
            return true;
        };
        /**
         * SameValueZero equality, matching the removal semantics of the ring.
         * Two NaN values are equal, and every other pair is equal when the two
         * references match exactly.
         */
        const same = (left: unknown, right: unknown): boolean =>
            left === right || (left !== left && right !== right);
        /** Reports whether the ring already holds an equal element. */
        const holds = (element: unknown): boolean => nodes().some(node => same(node.element, element));
        /**
         * The ring is an insertion-ordered set: positions follow the order in
         * which elements were first added and no element appears twice. Every
         * write therefore rejects a duplicate before it reaches the links, so a
         * rejected write leaves the ring and its samples untouched.
         */
        const collection = createCollection<unknown>({
            asynchronous, kind: "list", source,
            getValues: () => nodes().map(node => node.element),
            addValue: (element: unknown): boolean => holds(element) ? false : append(element),
            insertValue: (index: number, element: unknown): boolean =>
                holds(element) ? false : insertAt(index, element),
            setValue: (index: number, value: unknown): void => {
                const ring = nodes();
                if (ring.some((node, position) => position !== index && same(node.element, value))) {
                    throw new RangeError("Cycle elements must be unique.");
                }
                ring[index].element = value;
            },
            removeValue: (value: unknown): boolean => {
                const position = nodes().findIndex(node => same(node.element, value));
                if (position < 0) return false;
                removeAt(position);
                return true;
            },
            replaceValues: (values: readonly unknown[]): boolean => {
                const unique: unknown[] = [];
                for (const value of values) {
                    if (!unique.some(item => same(item, value))) unique.push(value);
                }
                return replaceAll(unique);
            },
            clearValues: (): void => { head = undefined; tail = undefined; count = 0; },
        }) as SynchronousList<unknown> | AsynchronousList<unknown>;
        const query = <T>(read: () => T): T | Promise<T> => readCollection(collection, read);
        /**
         * Maps an arbitrary cyclic position onto a node of the non-empty ring.
         * The reduction happens in `bigint`, so a position far beyond the exact
         * integer range of `number` still lands on the right node.
         */
        const nodeAt = (index: bigint): RingNode<unknown> | undefined => {
            requireIndex(index);
            if (count === 0) return undefined;
            const length = BigInt(count);
            const wrapped = ((index % length) + length) % length;
            let current: RingNode<unknown> = head!;
            for (let step = 0; step < Number(wrapped); step++) current = current.next!;
            return current;
        };
        /** Reduces a position to its exact residue within the current ring. */
        const residue = (index: bigint): number => {
            const length = BigInt(count);
            return Number(((index % length) + length) % length);
        };
        /** The intrinsic phase of a position, exact in the residue. */
        const intrinsic = (index: bigint): Angle =>
            phase.plus(useRadian(FullTurn * span * residue(index) / count));
        /** The angle the ambient environment has advanced after `time` seconds. */
        const ambient = (time: number): Angle => omega.phase(time);
        /** The element's own cyclic rate in hertz; zero makes it a fixed marker. */
        const rateValue = (node: RingNode<unknown>, index: bigint): number => {
            if (!rate) return 0;
            const value = rate(node.element, index);
            if (!(value instanceof Frequency)) {
                throw new TypeError("Cycle rate must be a Frequency.");
            }
            return value.getHertz();
        };
        /** The element's own phase after its rate has advanced it. */
        const advanced = (node: RingNode<unknown>, index: bigint, time: number): Angle =>
            intrinsic(index).plus(useRadian(FullTurn * rateValue(node, index) * time));
        /** The element's phase after both its own motion and the ambient motion. */
        const relativePhase = (node: RingNode<unknown>, index: bigint, time: number): Angle =>
            advanced(node, index, time).minus(ambient(time));
        const weightOf = (node: RingNode<unknown>, index: bigint): number => {
            const weight: number = magnitude(node.element, index);
            if (!isNumber(weight) || weight < 0) {
                throw new RangeError("Cycle magnitude must be a finite non-negative number.");
            }
            return weight;
        };
        const phasorOf = (node: RingNode<unknown>, index: bigint): Complex =>
            usePolar(weightOf(node, index), intrinsic(index));
        const viewOf = (node: RingNode<unknown>, index: bigint): CycleElement<unknown> => ({
            element: node.element,
            phase: intrinsic(index),
            frequency,
            complex: phasorOf(node, index),
        });
        const sampledElement = (index: bigint): Optional<CycleElement<unknown>> => {
            const node = nodeAt(index);
            return node ? Optional.of(viewOf(node, index)) : Optional.empty();
        };
        const sampledPhase = (index: bigint): Optional<Angle> =>
            nodeAt(index) ? Optional.of(intrinsic(index)) : Optional.empty();
        const sampledRelative = (index: bigint, time: number): Optional<Angle> => {
            const seconds = requireFinite(time, "Cycle time");
            const node = nodeAt(index);
            return node ? Optional.of(relativePhase(node, index, seconds)) : Optional.empty();
        };
        const viewAtTime = (node: RingNode<unknown>, index: bigint, seconds: number): CycleView<unknown> => {
            const current = advanced(node, index, seconds);
            return {
                element: node.element,
                index,
                time: seconds,
                phase: current,
                relative: current.minus(ambient(seconds)),
                rate: useHertz(rateValue(node, index)),
                complex: usePolar(weightOf(node, index), current),
            };
        };
        const sampledView = (index: bigint, time: number): Optional<CycleView<unknown>> => {
            const seconds = requireFinite(time, "Cycle time");
            const node = nodeAt(index);
            return node ? Optional.of(viewAtTime(node, index, seconds)) : Optional.empty();
        };
        const sampledViews = (time: number): CycleView<unknown>[] => {
            const seconds = requireFinite(time, "Cycle time");
            return nodes().map((node: RingNode<unknown>, position: number) =>
                viewAtTime(node, BigInt(position), seconds));
        };
        const sampledJet = (index: bigint, time: number): Optional<CycleJet<unknown>> => {
            const seconds = requireFinite(time, "Cycle time");
            const node = nodeAt(index);
            if (!node) return Optional.empty();
            const own: number = rateValue(node, index);
            return Optional.of({
                element: node.element,
                index,
                time: seconds,
                phase: advanced(node, index, seconds),
                rate: useHertz(own),
                slip: own - frequency.getHertz(),
            });
        };
        const sampledWinding = (index: bigint, time: number): Optional<bigint> => {
            const seconds = requireFinite(time, "Cycle time");
            const node = nodeAt(index);
            if (!node) return Optional.empty();
            const turns: number = (rateValue(node, index) - frequency.getHertz()) * seconds;
            return Optional.of(BigInt(Math.trunc(turns)));
        };
        const sampledError = (index: bigint, time: number, origin: number): Optional<number> => {
            const end = requireFinite(time, "Cycle time");
            const start = requireFinite(origin, "Cycle origin");
            const node = nodeAt(index);
            if (!node) return Optional.empty();
            const base = intrinsic(index).toRadianValue() / FullTurn;
            const slip = rateValue(node, index) - frequency.getHertz();
            return Optional.of(base * (end - start) + slip * (end * end - start * start) / 2);
        };
        const resultantValue = (time: number): Optional<number> => {
            const seconds = requireFinite(time, "Cycle time");
            const ring = nodes();
            if (ring.length === 0) return Optional.empty();
            let real = 0;
            let imaginary = 0;
            let total = 0;
            for (let position = 0; position < ring.length; position++) {
                const index = BigInt(position);
                const node = ring[position];
                const weight = weightOf(node, index);
                const angle = advanced(node, index, seconds).toRadianValue();
                real += weight * Math.cos(angle);
                imaginary += weight * Math.sin(angle);
                total += weight;
            }
            return Optional.of(total === 0 ? 0 : Math.hypot(real, imaginary) / total);
        };
        /**
         * Matches every observation back to the ring and measures it against
         * each ring element as a reference phase.
         */
        const analyseData = (data: Iterable<unknown>, time: number): CycleAnalysis<unknown> => {
            const seconds = requireFinite(time, "Cycle time");
            if (data === null || data === undefined || !(Symbol.iterator in Object(data))) {
                throw new TypeError("Cycle analyse data must be iterable.");
            }
            const ring = nodes();
            const positions = new Map<unknown, number>();
            for (let position = 0; position < ring.length; position++) {
                positions.set(ring[position].element, position);
            }
            const readings: CycleReading<unknown>[] = [];
            const hits: number[] = ring.map((): number => 0);
            let total = 0;
            for (const element of data) {
                total++;
                const position = positions.get(element);
                if (position === undefined) continue;
                hits[position]++;
                const index = BigInt(position);
                readings.push({
                    element,
                    index,
                    phase: intrinsic(index),
                    relative: relativePhase(ring[position], index, seconds),
                });
            }
            const references: CycleReference<unknown>[] = [];
            for (let position = 0; position < ring.length; position++) {
                const base = intrinsic(BigInt(position)).toRadianValue();
                let real = 0;
                let imaginary = 0;
                for (const reading of readings) {
                    const delta = reading.phase.toRadianValue() - base;
                    real += Math.cos(delta);
                    imaginary += Math.sin(delta);
                }
                const matched = readings.length;
                references.push({
                    element: ring[position].element,
                    index: BigInt(position),
                    count: hits[position],
                    resultant: matched === 0 ? 0 : Math.hypot(real, imaginary) / matched,
                    mean: matched === 0
                        ? Optional.empty()
                        : Optional.of(useRadian(Math.atan2(imaginary, real))),
                });
            }
            return {
                size: ring.length,
                total,
                matched: readings.length,
                missed: total - readings.length,
                readings,
                references,
            };
        };
        const phasors = (): Complex[] =>
            nodes().map((node: RingNode<unknown>, position: number) => phasorOf(node, BigInt(position)));
        const complex = (index?: bigint): Array<Complex> | Optional<Complex> => {
            if (index === undefined) {
                return phasors();
            }
            const node = nodeAt(index);
            return node ? Optional.of(phasorOf(node, index)) : Optional.empty();
        };
        const meanPhasor = (): Optional<Complex> => {
            const values = phasors();
            if (values.length === 0) return Optional.empty();
            let total = new Complex(0, 0);
            for (const value of values) total = total.plus(value);
            return Optional.of(total.divide(values.length));
        };
        /**
         * Returns the share of energy carried by the fundamental mode.
         *
         * The fundamental runs in one of two directions: a ring whose positions
         * traverse the circle backwards carries its energy in the opposite bin,
         * and its phase set is still the `n`-th roots of unity. The larger of
         * the two fundamental bins is therefore taken. Only those two bins and
         * the total energy are needed, so the cost stays linear in the ring
         * length instead of quadratic.
         */
        const purityValue = (): number => {
            const values = phasors();
            const length = values.length;
            if (length < 2) return 0;
            let forwardReal = 0;
            let forwardImaginary = 0;
            let backwardReal = 0;
            let backwardImaginary = 0;
            let energy = 0;
            for (let position = 0; position < length; position++) {
                const angle = FullTurn * position / length;
                const cosine = Math.cos(angle);
                const sine = Math.sin(angle);
                const x = values[position].getReal();
                const y = values[position].getImaginary();
                forwardReal += x * cosine + y * sine;
                forwardImaginary += y * cosine - x * sine;
                backwardReal += x * cosine - y * sine;
                backwardImaginary += x * sine + y * cosine;
                energy += x * x + y * y;
            }
            if (energy === 0) return 0;
            const forward = forwardReal * forwardReal + forwardImaginary * forwardImaginary;
            const backward = backwardReal * backwardReal + backwardImaginary * backwardImaginary;
            return (forward > backward ? forward : backward) / (length * energy);
        };
        /** Returns every symmetric-component bin, by a direct transform. */
        const spectrum = (): Complex[] => {
            const values = phasors();
            const length = values.length;
            const result: Complex[] = [];
            for (let order = 0; order < length; order++) {
                let real = 0;
                let imaginary = 0;
                for (let position = 0; position < length; position++) {
                    const angle = -FullTurn * order * position / length;
                    const cosine = Math.cos(angle);
                    const sine = Math.sin(angle);
                    const x = values[position].getReal();
                    const y = values[position].getImaginary();
                    real += x * cosine - y * sine;
                    imaginary += x * sine + y * cosine;
                }
                result.push(new Complex(real, imaginary));
            }
            return result;
        };
        const balanced = (epsilon: number = 1E-9): boolean => {
            const tolerance = Math.abs(requireFinite(epsilon, "Cycle epsilon"));
            if (count < 2) return false;
            return 1 - purityValue() <= tolerance;
        };
        /**
         * Wraps the symmetric components in a `Spectrum` whose plan gives bin
         * `j` the rate `j` cycles per revolution.
         */
        const spatialSpectrum = (): Optional<Spectrum> => {
            const values = spectrum();
            if (values.length === 0) return Optional.empty();
            return Optional.of(new Spectrum(new Sample(values.length, 1), values));
        };
        const scored = (index: bigint, time: number, field: PhaseField): Optional<number> => {
            requireField(field);
            const relative = sampledRelative(index, time);
            return relative.isEmpty() ? Optional.empty() : Optional.of(field.sample(relative.get()));
        };
        const scoredAll = (time: number, field: PhaseField): number[] => {
            requireField(field);
            const seconds = requireFinite(time, "Cycle time");
            const offset = ambient(seconds);
            const values: number[] = [];
            const ring = nodes();
            for (let position = 0; position < ring.length; position++) {
                const index = BigInt(position);
                const node = ring[position];
                values.push(field.sample(advanced(node, index, seconds).minus(offset)));
            }
            return values;
        };
        Object.assign(collection, {
            getPhase: (): Angle => phase,
            getFrequency: (): Frequency => frequency,
            getSpan: (): number => span,
            elementAt: (index: bigint) => query(() => sampledElement(index)),
            frequencyAt: (index: bigint) => query(() => nodeAt(index) ? Optional.of(frequency) : Optional.empty()),
            phaseAt: (index: bigint) => query(() => sampledPhase(index)),
            relativeAt: (index: bigint, time: number) => query(() => sampledRelative(index, time)),
            viewAt: (index: bigint, time: number) => query(() => sampledView(index, time)),
            viewsAt: (time: number) => query(() => sampledViews(time)),
            jetAt: (index: bigint, time: number) => query(() => sampledJet(index, time)),
            windingAt: (index: bigint, time: number) => query(() => sampledWinding(index, time)),
            errorIntegralAt: (index: bigint, time: number, origin: number = 0) =>
                query(() => sampledError(index, time, origin)),
            resultant: (time: number = 0) => query(() => resultantValue(time)),
            analyse: (data: Iterable<unknown>, time: number = 0) => query(() => analyseData(data, time)),
            toComplex: (index?: bigint) => query(() => complex(index)),
            zeroSequence: () => query(() => meanPhasor()),
            purity: () => query(() => purityValue()),
            sequences: () => query(() => spectrum()),
            toSpectrum: () => query(() => spatialSpectrum()),
            isBalanced: (epsilon?: number) => query(() => balanced(epsilon)),
            scoreAt: (index: bigint, time: number, field: PhaseField) => query(() => scored(index, time, field)),
            scoresAt: (time: number, field: PhaseField) => query(() => scoredAll(time, field)),
        });
        return Object.setPrototypeOf(collection, new.target.prototype);
    };
    Object.defineProperty(constructor, "name", { value: name });
    const parent = asynchronous ? AsynchronousList : SynchronousList;
    Object.setPrototypeOf(constructor.prototype, parent.prototype);
    Object.setPrototypeOf(constructor, parent);
    return constructor;
}

/**
 * Creates a cycle sampling one phasor per list position.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousCycle: AsynchronousCycleConstructor =
    createCycleConstructor("AsynchronousCycle", true) as unknown as AsynchronousCycleConstructor;
/**
 * A two-dimensional spectrum over temporal frequency and spatial wavenumber.
 *
 * The matrix is indexed `cells[frame][order]`, where the frame axis follows the
 * instants supplied to the builder and the order axis is the symmetric
 * component index of the ring at that instant. Taking one column gives the time
 * series of a single spatial mode, and taking its temporal transform gives that
 * mode's frequency content, so the pair `(frame, order)` is the `(omega, n)`
 * plane.
 *
 * Unlike `Spectrum`, this container never assumes conjugate symmetry: the modes
 * of a phase ring are complex, so both halves of the order axis carry distinct
 * information and no one-sided reduction is offered.
 */
export interface AngularSpectrum {
    /** The ring length, which is the number of distinct wavenumbers. */
    readonly order: number;
    /** The number of sampled instants. */
    readonly frameCount: number;
    /** The sampling plan describing the instants, one frame each. */
    readonly plan: Sample;
    /** The coefficients, indexed `cells[frame][order]`. */
    readonly cells: ReadonlyArray<ReadonlyArray<Complex>>;
    /** Returns the time series of one spatial mode. */
    mode(order: number): Optional<ReadonlyArray<Complex>>;
    /** Returns the temporal spectrum of one spatial mode. */
    spectrum(order: number): Optional<Spectrum>;
}

/**
 * Builds an `(omega, n)` spectrum from a cycle sampled at several instants.
 *
 * Each instant contributes one frame of phasors, and frame `k` of mode `j` is
 * the `j`-th symmetric component of that frame. The plan must describe exactly
 * the supplied instants, one frame each, because it fixes the frequency axis
 * that the per-mode spectra are reported against.
 *
 * @param cycle the synchronous ring to sample
 * @param instants the elapsed times, in seconds, at which to sample it
 * @param plan the sampling plan describing those instants
 * @returns the two-dimensional spectrum
 * @throws {TypeError} if the cycle or plan is not of the expected type
 * @throws {RangeError} if the plan does not match the number of instants
 */
export const useAngularSpectrum: (
    cycle: SynchronousCycle<unknown>,
    instants: Iterable<number>,
    plan: Sample,
) => AngularSpectrum = (
    cycle: SynchronousCycle<unknown>,
    instants: Iterable<number>,
    plan: Sample,
): AngularSpectrum => {
    if (!cycle || typeof cycle.viewsAt !== "function") {
        throw new TypeError("AngularSpectrum cycle must be a SynchronousCycle.");
    }
    if (!(plan instanceof Sample)) {
        throw new TypeError("AngularSpectrum plan must be a Sample.");
    }
    const cells: Complex[][] = [];
    for (const instant of instants) {
        if (!isNumber(instant)) {
            throw new TypeError("AngularSpectrum instants must be finite numbers.");
        }
        const phasors = cycle.viewsAt(instant).map((view: CycleView<unknown>) => view.complex);
        const length = phasors.length;
        const frame: Complex[] = [];
        for (let order = 0; order < length; order++) {
            let real = 0;
            let imaginary = 0;
            for (let position = 0; position < length; position++) {
                const angle = -FullTurn * order * position / length;
                const cosine = Math.cos(angle);
                const sine = Math.sin(angle);
                const x = phasors[position].getReal();
                const y = phasors[position].getImaginary();
                real += x * cosine - y * sine;
                imaginary += x * sine + y * cosine;
            }
            frame.push(new Complex(real, imaginary));
        }
        cells.push(frame);
    }
    const order = cells.length === 0 ? 0 : cells[0].length;
    for (const frame of cells) {
        if (frame.length !== order) {
            throw new RangeError("AngularSpectrum frames must all have the same length.");
        }
    }
    if (plan.getCount() !== cells.length) {
        throw new RangeError("AngularSpectrum plan must cover exactly the supplied instants.");
    }
    const frozen = Object.freeze(cells.map((frame: Complex[]) => Object.freeze(frame)));
    const column = (index: number): Optional<ReadonlyArray<Complex>> => {
        if (!Number.isInteger(index) || index < 0 || index >= order) return Optional.empty();
        return Optional.of(Object.freeze(cells.map((frame: Complex[]) => frame[index])));
    };
    return Object.freeze({
        order,
        frameCount: cells.length,
        plan,
        cells: frozen,
        mode: (index: number): Optional<ReadonlyArray<Complex>> => column(index),
        spectrum: (index: number): Optional<Spectrum> => {
            const series = column(index);
            return series.isEmpty() ? Optional.empty() : Optional.of(new Spectrum(plan, series.get()));
        },
    });
};

/**
 * The joint ring produced by combining two cycles.
 *
 * The combined period is the least common multiple of the two lengths, not
 * their product: a joint instant determines both readings, so only the pairs
 * that share a common residue modulo the greatest common divisor can occur.
 * The remaining pairs are the ones the combination never produces, which is why
 * the joint state space is a pullback rather than a product.
 *
 * @template A the element type of the left cycle
 * @template B the element type of the right cycle
 */
export interface CycleCombination<A, B> {
    /** The joined period, the least common multiple of the two lengths. */
    readonly period: bigint;
    /** The greatest common divisor of the two lengths. */
    readonly divisor: bigint;
    /** The joint ring, one element per instant of the period. */
    readonly cycle: SynchronousCycle<readonly [A, B]>;
    /** Reports whether two positions can come from the same instant. */
    aligns(left: bigint, right: bigint): boolean;
}

const gcdOf: (left: bigint, right: bigint) => bigint = (left: bigint, right: bigint): bigint => {
    let x: bigint = left < 0n ? -left : left;
    let y: bigint = right < 0n ? -right : right;
    while (y !== 0n) {
        const remainder: bigint = x % y;
        x = y;
        y = remainder;
    }
    return x;
}

/**
 * Combines two synchronous cycles into their joint ring.
 *
 * Instant `i` of the joint ring reads position `i mod m` of the left cycle and
 * position `i mod n` of the right cycle, so the joint ring closes after
 * `lcm(m, n)` instants. The pairs that can never co-occur — those whose
 * positions disagree modulo `gcd(m, n)` — are simply absent, and `aligns`
 * reports whether a given pair is representable.
 *
 * Both sources must be non-empty. The combined ring is a fresh cycle with a
 * full-turn span and no phase anchor; the phases of the sources describe their
 * own geometry and do not transfer to the joint ring.
 *
 * @param left the left cycle
 * @param right the right cycle
 * @returns the combination, carrying the joint ring and the compatibility test
 * @throws {TypeError} if either operand is not a synchronous cycle
 * @throws {RangeError} if either operand is empty
 */
export const combineCycles: <A, B>(
    left: SynchronousCycle<A>,
    right: SynchronousCycle<B>,
) => CycleCombination<A, B> = <A, B>(
    left: SynchronousCycle<A>,
    right: SynchronousCycle<B>,
): CycleCombination<A, B> => {
    if (!left || typeof left.get !== "function") {
        throw new TypeError("CycleCombination left must be a SynchronousCycle.");
    }
    if (!right || typeof right.get !== "function") {
        throw new TypeError("CycleCombination right must be a SynchronousCycle.");
    }
    const leftSize: bigint = left.size();
    const rightSize: bigint = right.size();
    if (leftSize === 0n || rightSize === 0n) {
        throw new RangeError("CycleCombination requires two non-empty cycles.");
    }
    const divisor: bigint = gcdOf(leftSize, rightSize);
    const period: bigint = leftSize / divisor * rightSize;
    const pairs: Array<readonly [A, B]> = [];
    for (let index = 0n; index < period; index++) {
        pairs.push([left.get(index % leftSize), right.get(index % rightSize)] as const);
    }
    const cycle = new SynchronousCycle<readonly [A, B]>(pairs);
    return {
        period,
        divisor,
        cycle,
        aligns: (first: bigint, second: bigint): boolean => {
            if (typeof first !== "bigint" || typeof second !== "bigint") {
                throw new TypeError("CycleCombination positions must be bigints.");
            }
            return ((first - second) % divisor + divisor) % divisor === 0n;
        },
    };
};

/**
 * Creates a cycle sampling one phasor per list position.
 * Operations return their results directly.
 */
export const SynchronousCycle: SynchronousCycleConstructor =
    createCycleConstructor("SynchronousCycle", false) as unknown as SynchronousCycleConstructor;
