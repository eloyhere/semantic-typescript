import { isIterable, isNumber } from "#semantic/guard";
import { Complex } from "#semantic/mathematics/complex";
import { Epicycle, isEpicycle } from "#semantic/mathematics/epicycle";
import { WaveformSymbol } from "#semantic/symbol";

/**
 * A superposition of complex exponentials, that is, a finite Fourier series.
 *
 * The waveform evaluates to the sum of its phasor contributions, so term order
 * does not affect the value, though it does affect floating-point rounding. The
 * sum is complex; a real signal is the real part of that sum. Differentiation
 * and integration are applied term by term, so symbolic results require every
 * amplitude to be constant and, for integration, every angular rate to be
 * non-zero.
 *
 * A waveform is immutable; `append` returns a new instance. The terms are frozen
 * in insertion order, and `isWaveform` recognises instances at runtime.
 */
export class Waveform {

    private readonly epicycles: ReadonlyArray<Epicycle>;
    protected readonly [WaveformSymbol]: symbol = WaveformSymbol;

    public constructor();
    public constructor(iterable: Iterable<Epicycle>);
    /**
     * Creates a waveform from an iterable of epicycles.
     *
     * The iterable is copied and frozen, so later changes to the source do not
     * affect this waveform. An omitted iterable creates the empty waveform, which
     * evaluates to zero everywhere.
     *
     * @param iterable the phasor terms in insertion order; defaults to none
     * @throws {TypeError} if the argument is not iterable or contains a non-epicycle
     */
    public constructor(iterable: Iterable<Epicycle> = []) {
        if (!isIterable(iterable)) {
            throw new TypeError("Waveform expects an iterable of epicycles.");
        }
        const collected: Array<Epicycle> = [];
        for (const epicycle of iterable) {
            if (!isEpicycle(epicycle)) {
                throw new TypeError("Waveform iterable must contain only epicycles.");
            }
            collected.push(epicycle);
        }
        this.epicycles = Object.freeze(collected);
    }

    /**
     * Returns the phasor terms of this waveform.
     *
     * The array is frozen, so it cannot be reordered or extended in place.
     *
     * @returns the terms in insertion order
     */
    public getEpicycles(): ReadonlyArray<Epicycle> {
        return this.epicycles;
    }

    /**
     * Returns the number of phasor terms.
     *
     * @returns the term count, zero for an empty waveform
     */
    public size(): number {
        return this.epicycles.length;
    }

    /**
     * Reports whether this waveform has no phasor terms.
     *
     * An empty waveform evaluates to zero at every time, and its symbolic
     * derivative and antiderivative are empty waveforms again.
     *
     * @returns `true` if there are no terms
     */
    public isEmpty(): boolean {
        return this.epicycles.length === 0;
    }

    /**
     * Returns a new waveform with one more phasor term appended.
     *
     * The receiver is unchanged, so appending in a loop copies the terms at every
     * step and costs time linear in the existing term count.
     *
     * @param epicycle the term appended after the existing terms
     * @returns a new waveform with the extra term
     * @throws {TypeError} if the value is not an epicycle
     */
    public append(epicycle: Epicycle): Waveform {
        if (!isEpicycle(epicycle)) {
            throw new TypeError("Waveform appended value must be an Epicycle.");
        }
        return new Waveform([...this.epicycles, epicycle]);
    }

    /**
     * Evaluates the summed complex contribution of every phasor at a point in time.
     *
     * Terms are added in insertion order, so floating-point rounding can differ
     * from an equivalent reordered sum. The cost is linear in the term count, and
     * an empty waveform returns zero for every finite time. The real part of the
     * result is the cosine carrier sum and the imaginary part is the sine sum.
     *
     * @param time the finite time in seconds at which to evaluate this waveform
     * @returns the complex sum of the phasor contributions at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public value(time: number): Complex {
        if (!isNumber(time)) {
            throw new TypeError("Waveform time must be a finite number of seconds.");
        }
        let total: Complex = new Complex(0, 0);
        for (const epicycle of this.epicycles) {
            total = total.plus(epicycle.value(time));
        }
        return total;
    }

    /**
     * Evaluates the summed complex contribution of every phasor at a point in time.
     *
     * This is an alias for `value`, kept for symmetry with `Envelope.at` and
     * `Epicycle.at`, and it rejects the same non-finite times.
     *
     * @param time the finite time in seconds at which to evaluate this waveform
     * @returns the complex sum of the phasor contributions at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public at(time: number): Complex {
        return this.value(time);
    }

    /**
     * Returns the term-wise derivative waveform.
     *
     * Every term is differentiated symbolically, so every amplitude must be
     * constant; the first offending term raises `RangeError` and no partial
     * waveform is returned.
     *
     * @returns a new waveform of derivative terms
     * @throws {RangeError} if any term has a non-constant amplitude
     */
    public derivate(): Waveform;
    /**
     * Evaluates the complex derivative of the summed contribution at a point in time.
     *
     * The derivatives of the individual terms are summed, each using the exact
     * symbolic form for a constant amplitude and a finite difference otherwise,
     * so the cost is linear in the term count.
     *
     * @param time the finite time in seconds at which to differentiate
     * @returns the complex derivative of the summed contribution at that time
     * @throws {TypeError} if the time is not a finite number
     */
    public derivate(time: number): Complex;
    public derivate(time?: number): Waveform | Complex {
        if (time === undefined) {
            return new Waveform(this.epicycles.map((epicycle: Epicycle): Epicycle => epicycle.derivate()));
        }
        if (!isNumber(time)) {
            throw new TypeError("Waveform time must be a finite number of seconds.");
        }
        let total: Complex = new Complex(0, 0);
        for (const epicycle of this.epicycles) {
            total = total.plus(epicycle.derivate(time));
        }
        return total;
    }

    /**
     * Returns the term-wise antiderivative waveform.
     *
     * Every term is integrated symbolically, so every amplitude must be constant
     * and every angular rate non-zero; the first offending term raises
     * `RangeError` and no partial waveform is returned.
     *
     * @returns a new waveform of antiderivative terms
     * @throws {RangeError} if any term has a non-constant amplitude or zero rate
     */
    public integral(): Waveform;
    /**
     * Integrates the summed complex contribution over a closed interval.
     *
     * Each term is integrated separately and the results are summed, using the
     * exact symbolic form where possible and adaptive Simpson quadrature with a
     * tolerance of 1E-10 otherwise. A reversed interval is rejected rather than
     * negated.
     *
     * @param start the inclusive lower bound in seconds
     * @param end the inclusive upper bound in seconds, not before the start
     * @returns the complex definite integral of the summed contribution
     * @throws {TypeError} if a bound is missing or is not a finite number
     * @throws {RangeError} if the end precedes the start
     */
    public integral(start: number, end: number): Complex;
    public integral(start?: number, end?: number): Waveform | Complex {
        if (start === undefined && end === undefined) {
            return new Waveform(this.epicycles.map((epicycle: Epicycle): Epicycle => epicycle.integral()));
        }
        if (start === undefined || end === undefined) {
            throw new TypeError("Waveform integral requires both a start and an end.");
        }
        if (!isNumber(start) || !isNumber(end)) {
            throw new TypeError("Waveform integral bounds must be finite numbers of seconds.");
        }
        if (end < start) {
            throw new RangeError("Waveform integral end must not precede the start.");
        }
        let total: Complex = new Complex(0, 0);
        for (const epicycle of this.epicycles) {
            total = total.plus(epicycle.integral(start, end));
        }
        return total;
    }

    /**
     * Renders this waveform for debugging.
     *
     * The rendering reports only the term count, so two waveforms with different
     * parameters are indistinguishable in the output.
     *
     * @returns a description containing the number of terms
     */
    public toString(): string {
        return `Waveform(${this.epicycles.length})`;
    }
}

export { isWaveform } from "#semantic/guard";
