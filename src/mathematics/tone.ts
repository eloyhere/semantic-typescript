import { isNumber } from "#semantic/guard";
import { Angle, useRadian } from "#semantic/mathematics/angle";
import { Envelope } from "#semantic/mathematics/envelope";
import { Epicycle } from "#semantic/mathematics/epicycle";
import { Frequency } from "#semantic/mathematics/frequency";
import { Omega } from "#semantic/mathematics/omega";
import { Waveform } from "#semantic/mathematics/waveform";
import { ToneSymbol } from "#semantic/symbol";

/**
 * A single sustained note: a frequency, a phase offset and an amplitude envelope.
 *
 * The tone value at a time `t` in seconds is `envelope(t) * sin(2*PI*f*t +
 * phase)`. Because a tone is one sinusoidal voice at a fixed frequency, it
 * projects exactly into one epicycle and into a one-term waveform, and both
 * projections share the stored phase and envelope rather than copying them.
 *
 * A tone is immutable; `transpose`, `withEnvelope` and `withPhase` return new
 * instances. `isTone` recognises instances at runtime.
 */
export class Tone {

    private readonly frequency: Frequency;
    private readonly phase: Angle;
    private readonly envelope: Envelope;
    protected readonly [ToneSymbol]: symbol = ToneSymbol;

    /**
     * Creates a tone from a frequency, a phase offset and an envelope.
     *
     * All arguments are stored by reference. The phase defaults to zero radians
     * and the envelope to the constant level one, so a tone can be built from the
     * frequency alone.
     *
     * @param frequency the carrier frequency
     * @param phase the phase offset; defaults to zero radians
     * @param envelope the amplitude envelope; defaults to a constant one
     * @throws {TypeError} if an argument is not an instance of its expected type
     */
    public constructor(frequency: Frequency, phase: Angle = useRadian(0), envelope: Envelope = new Envelope(1)) {
        if (!(frequency instanceof Frequency)) {
            throw new TypeError("Tone frequency must be a Frequency.");
        }
        if (!(phase instanceof Angle)) {
            throw new TypeError("Tone phase must be an Angle.");
        }
        if (!(envelope instanceof Envelope)) {
            throw new TypeError("Tone envelope must be an Envelope.");
        }
        this.frequency = frequency;
        this.phase = phase;
        this.envelope = envelope;
    }

    /**
     * Returns the carrier frequency of this tone.
     *
     * The frequency is the cyclic rate in hertz, not the angular rate.
     *
     * @returns the frequency supplied at construction
     */
    public getFrequency(): Frequency {
        return this.frequency;
    }

    /**
     * Returns the phase offset of this tone.
     *
     * The offset is added to the accumulated rotation and is normalised into one
     * full turn by `Angle` itself.
     *
     * @returns the phase offset supplied at construction
     */
    public getPhase(): Angle {
        return this.phase;
    }

    /**
     * Returns the amplitude envelope of this tone.
     *
     * The envelope is shared rather than copied, so the returned instance is the
     * one supplied at construction.
     *
     * @returns the amplitude envelope supplied at construction
     */
    public getEnvelope(): Envelope {
        return this.envelope;
    }

    /**
     * Returns the angular rate equivalent to this tone's frequency.
     *
     * The conversion multiplies the frequency in hertz by one full turn, so the
     * rate is `2*PI*f` radians per second. A static carrier yields the zero rate.
     *
     * @returns the angular rate of the carrier
     */
    public getOmega(): Omega {
        return this.frequency.toOmega();
    }

    /**
     * Evaluates the tone at a point in time.
     *
     * The envelope is sampled at the same time and multiplied by the carrier,
     * whose argument is `2*PI*f*t + phase` radians. Evaluation costs one envelope
     * sample and one sine per call.
     *
     * @param time the finite time in seconds at which to evaluate this tone
     * @returns the shaped carrier value at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public value(time: number): number {
        if (!isNumber(time)) {
            throw new TypeError("Tone time must be a finite number of seconds.");
        }
        return this.envelope.at(time) * Math.sin(this.frequency.getRadianPerSecond() * time + this.phase.toRadianValue());
    }

    /**
     * Evaluates the tone at a point in time.
     *
     * This is an alias for `value`, kept for symmetry with `Envelope.at` and
     * `Waveform.at`, and it rejects the same non-finite times.
     *
     * @param time the finite time in seconds at which to evaluate this tone
     * @returns the shaped carrier value at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public at(time: number): number {
        return this.value(time);
    }

    /**
     * Projects this tone into a single complex exponential.
     *
     * The epicycle keeps the same envelope and angular rate, but its phase is
     * reduced by a quarter turn. A tone is a real sine while an epicycle is a
     * complex exponential, so this shift makes the real part of the epicycle equal
     * the tone value at every time; the imaginary part is the quadrature carrier.
     *
     * @returns a complex exponential whose real part equals this tone
     */
    public toEpicycle(): Epicycle {
        return new Epicycle(this.envelope, this.getOmega(), this.phase.minus(useRadian(Math.PI / 2)));
    }

    /**
     * Projects this tone into a one-term waveform.
     *
     * The waveform contains the epicycle of this tone, so the real part of its
     * complex value matches this tone's value and it can be combined with other
     * voices as a superposition.
     *
     * @returns a waveform whose only term is this tone's epicycle
     */
    public toWaveform(): Waveform {
        return new Waveform([this.toEpicycle()]);
    }

    /**
     * Returns a copy of this tone transposed by equal-tempered semitones.
     *
     * The phase and envelope are shared with the receiver; only the frequency is
     * rescaled by the twelfth root of two per semitone, so negative semitones
     * lower the pitch and zero semitones return an equal tone.
     *
     * @param semitones the number of equal-tempered semitones to add
     * @returns a new tone at the transposed frequency
     * @throws {TypeError} if the semitone count is not a finite number
     */
    public transpose(semitones: number): Tone {
        return new Tone(this.frequency.transpose(semitones), this.phase, this.envelope);
    }

    /**
     * Returns a copy of this tone with another amplitude envelope.
     *
     * The frequency and phase are shared with the receiver.
     *
     * @param envelope the replacement amplitude envelope
     * @returns a new tone carrying the supplied envelope
     * @throws {TypeError} if the value is not an envelope
     */
    public withEnvelope(envelope: Envelope): Tone {
        return new Tone(this.frequency, this.phase, envelope);
    }

    /**
     * Returns a copy of this tone with another phase offset.
     *
     * The frequency and envelope are shared with the receiver.
     *
     * @param phase the replacement phase offset
     * @returns a new tone carrying the supplied phase
     * @throws {TypeError} if the value is not an angle
     */
    public withPhase(phase: Angle): Tone {
        return new Tone(this.frequency, phase, this.envelope);
    }

    /**
     * Compares the frequency, phase and envelope of two tones.
     *
     * The frequency and phase are compared within the tolerance. The envelopes
     * are compared only when both are constant, so an evaluator-backed envelope
     * never equals a constant one and two evaluator-backed envelopes match on
     * their constant flags alone. Values are sampled nowhere.
     *
     * @param other the tone to compare with this one
     * @param epsilon the tolerance applied to the frequency and phase;
     *        defaults to 1E-9
     * @returns `true` if the parameters match within the tolerance
     * @throws {TypeError} if the operand is not a tone or the tolerance is not a
     *         finite number
     */
    public equals(other: Tone, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Tone)) {
            throw new TypeError("Tone operand must be a Tone.");
        }
        return this.frequency.equals(other.frequency, epsilon)
            && this.phase.equals(other.phase, epsilon)
            && this.envelope.isConstant() === other.envelope.isConstant()
            && (!this.envelope.isConstant() || Math.abs(this.envelope.getConstant() - other.envelope.getConstant()) <= Math.abs(epsilon));
    }

    /**
     * Renders the parameters of this tone for debugging.
     *
     * Each component uses its own rendering, so a constant envelope reports its
     * level while an evaluator-backed one reports only that it is a function.
     *
     * @returns a description containing the frequency, phase and envelope
     */
    public toString(): string {
        return `Tone(${this.frequency}, ${this.phase}, ${this.envelope})`;
    }
}

export { isTone } from "#semantic/guard";
