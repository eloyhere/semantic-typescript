/**
 * The synchronous signal collector factories.
 *
 * Every `useSynchronous*` factory in this module buffers a source and hands it to
 * exactly one helper from `#semantic/synchronous/signal`; the facade class in
 * that module delegates to exactly one factory per analysis method. This module
 * contains only the collector factories: the helpers, `SpectralDensity` and the
 * facade class all live in the facade module.
 *
 * The modules form an intentional import cycle: the factories read the helpers,
 * and the facade class calls the factories. Every use is deferred to a closure,
 * so evaluation order is safe; the binder state below is a `var` and the binder
 * is a function declaration so that the facade's bind call at the end of its
 * module evaluation is also safe when this module is the first import.
 *
 * @module
 */

import { IllegalStateError } from "#semantic/structure/error";
import { windowed } from "#semantic/mathematics/window";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import {
    signalAmplitude,
    signalAnalyticSignal,
    signalAutocorrelation,
    signalDecibel,
    signalDetrend,
    signalEnvelope,
    signalInstantaneousFrequency,
    signalInstantaneousPhase,
    signalOneSided,
    signalPower,
    signalPowerDecibel,
    signalPowerSpectralDensity,
    signalShortTimeFourierTransform,
    signalSignalToNoiseRatio,
    signalSpectralBandwidth,
    signalSpectralCentroid,
    signalSpectralFlatness,
    signalSpectralFlux,
    signalSpectralRolloff,
    signalSpectrogram,
    signalSpectrum,
    signalZeroCrossingRate
} from "#semantic/synchronous/signal";
import { Sampler } from "#semantic/mathematics/sampler";
import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Complex } from "#semantic/mathematics/complex";
import type { Frequency } from "#semantic/mathematics/frequency";
import type { Sample } from "#semantic/mathematics/sample";
import type { Samplable } from "#semantic/mathematics/sampler";
import type { Spectrogram } from "#semantic/mathematics/spectrogram";
import type { Spectrum } from "#semantic/mathematics/spectrum";
import type { WaveletLevel } from "#semantic/mathematics/spectral";
import type { SpectralWindow } from "#semantic/mathematics/window";
import type { Optional } from "#semantic/optional";
import type {
    CorrelationNormalization,
    DetrendMode,
    SpectralDensity
} from "#semantic/synchronous/signal";
/*
 * The binder signature names the facade class. The reference is a type-only
 * import, so `verbatimModuleSyntax` erases it and this module has no runtime
 * dependency on the facade beyond the helper values it already imports.
 */
import type { SynchronousSignalCollectable } from "../signal.js";

/**
 * The constructor bridge injected by the signal facade.
 *
 * The factories may name the collectable type but must not import the class at
 * runtime; the facade supplies one implementation after its class is defined.
 *
 * @template E - The element type of the samples being finished.
 */
export interface SignalCollectableFactory {
    /**
     * Builds a signal from an already prepared sample array.
     *
     * @param plan - The sampling plan of the signal.
     * @param values - The samples of the signal, at least one.
     * @param window - The analysis window retained by the signal.
     * @returns A new synchronous signal over `values`.
     */
    create<E extends number>(plan: Sample, values: ReadonlyArray<E>, window: SpectralWindow): SynchronousSignalCollectable<number>;
}
/*
 * `var` and a function declaration are deliberate. The facade calls this binder
 * at the end of its own evaluation, which can happen while this module is still
 * in its import phase when this module is the first import. Both bindings are
 * initialised during module instantiation, so that call is not in a temporal
 * dead zone; a `let` or a `const` arrow would be.
 */
var signalCollectableFactory: SignalCollectableFactory | undefined;
/**
 * Binds the collectable constructor used by the factories that return a signal.
 *
 * @param factory - The constructor bridge to use.
 */
export function bindSignalCollectableFactory(factory: SignalCollectableFactory): void {
    signalCollectableFactory = factory;
}

/*
 * ---------------------------------------------------------------------------
 * Signal analysis collectors
 * ---------------------------------------------------------------------------
 *
 * The factories below are the strategies exposed by the signal facade. Each one
 * buffers the samples of the source and hands them to exactly one numeric helper
 * from `#semantic/synchronous/signal`, so the one-method-one-factory rule holds
 * by construction: `useSynchronous<Method>` is the only strategy `Method` uses,
 * no two methods share a factory, and no method inlines one.
 *
 * The two factories that finish with a signal (`Detrended` and `Windowed`)
 * construct it through the binder above; the facade binds its class at the end
 * of its module evaluation.
 */

/**
 * Creates a collector that finishes with the signal after trend removal.
 *
 * The collector buffers the source and replaces it with the detrended sequence,
 * keeping the plan and the window, so the result is the same signal with
 * different samples. The default mode removes the mean, which is what a density
 * estimate wants; a linear mode removes a drift as well.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window retained for the result.
 * @param mode - The trend to remove.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source holds a non-finite sample or the mode is not
 *         a supported name.
 * @throws {RangeError} If the source is empty or the window sums to zero.
 */
export let useSynchronousDetrended: <E extends number>(plan: Sample, window: SpectralWindow, mode: DetrendMode) => SynchronousCollector<E, Array<E>, SynchronousSignalCollectable<number>> = <E extends number>(plan: Sample, window: SpectralWindow, mode: DetrendMode): SynchronousCollector<E, Array<E>, SynchronousSignalCollectable<number>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousSignalCollectable<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousSignalCollectable<number> => {
        if (signalCollectableFactory === undefined) {
            throw new IllegalStateError("Signal collector factories require the collectable to be bound before use.");
        }
        return signalCollectableFactory.create(plan, signalDetrend(array, mode), window);
    });
};

/**
 * Creates a collector that finishes with the signal re-weighted by a window.
 *
 * The buffered samples are multiplied by the supplied taper and the result keeps
 * the plan and adopts the taper as its own analysis window, so a later spectral
 * call does not apply it a second time.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The taper to apply and to retain.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source holds a non-finite sample or the window is
 *         not callable.
 * @throws {RangeError} If the source is empty or a window weight is not finite.
 */
export let useSynchronousWindowed: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, SynchronousSignalCollectable<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, SynchronousSignalCollectable<number>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousSignalCollectable<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousSignalCollectable<number> => {
        if (signalCollectableFactory === undefined) {
            throw new IllegalStateError("Signal collector factories require the collectable to be bound before use.");
        }
        return signalCollectableFactory.create(plan, windowed(array, window), window);
    });
};

/**
 * Creates a collector that finishes with the windowed complex transform.
 *
 * The transform length may exceed the sample count, which zero-pads after the
 * taper has been applied. Padding interpolates the DTFT and never resolves two
 * components that the window length merges.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param size - The transform length in samples.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the length would truncate the signal.
 */
export let useSynchronousSpectrum: <E extends number>(plan: Sample, size: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Spectrum> = <E extends number>(plan: Sample, size: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Spectrum> => {
    return SynchronousCollector.full<E, Array<E>, Spectrum>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Spectrum => {
        return signalSpectrum(plan, array, size, window);
    });
};

/**
 * Creates a collector that finishes with the one-sided bins of the signal.
 *
 * Every interior bin is doubled to fold its conjugate mirror, while DC and, for
 * an even length, Nyquist keep the value the transform produced. Doubling those
 * two self-conjugate bins would invent 6.02 decibels of energy.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param size - The transform length in samples.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the length would truncate the signal.
 */
export let useSynchronousOneSided: <E extends number>(plan: Sample, size: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<Bin>> = <E extends number>(plan: Sample, size: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<Bin>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Bin>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Bin> => {
        return signalOneSided(plan, array, size, window);
    });
};

/**
 * Creates a collector that finishes with the calibrated one-sided amplitudes.
 *
 * The estimate divides by `count * coherentGain(window, count)` and doubles the
 * interior bins, so a unit sinusoid reads one at its own bin. The gain is taken
 * from the actual window vector rather than assumed to be one half.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousAmplitude: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalAmplitude(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the one-sided powers.
 *
 * An interior bin reports `A[k]^2 / 2` and a self-conjugate bin reports
 * `A[k]^2`, so the sum over every bin is the mean square times the equivalent
 * noise bandwidth rather than the mean square itself.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousPower: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalPower(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the amplitude levels in decibels.
 *
 * The conversion is `20 * log10`, the amplitude convention. It is wrong for a
 * power or a density, which must go through `useSynchronousPowerDecibel`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousDecibel: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalDecibel(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the power levels in decibels.
 *
 * The conversion is `10 * log10`, the power convention, which is the only correct
 * one for a power, an energy, a mean square or a density.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousPowerDecibel: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalPowerDecibel(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with a Welch power spectral density.
 *
 * The record is cut into overlapping segments, each one is detrended, weighted and
 * transformed, and the periodograms are averaged. The divisor is
 * `rate * sum(w^2)`, which is the only one that keeps a white-noise floor
 * unbiased.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The segment length in samples.
 * @param hopSize - The samples between segment starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framing is impossible or the window weights are all
 *         zero.
 */
export let useSynchronousPowerSpectralDensity: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, SpectralDensity> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, SpectralDensity> => {
    return SynchronousCollector.full<E, Array<E>, SpectralDensity>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SpectralDensity => {
        return signalPowerSpectralDensity(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the short-time Fourier transform.
 *
 * The signal is extended by half a frame at each end and the tail is padded, so
 * the first frame is centred on the first sample and no sample is dropped. Frame
 * centres are reported at multiples of the hop on the original axis.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the frame exceeds the signal, the hop exceeds the frame,
 *         or the framing yields no frame.
 */
export let useSynchronousShortTimeFourierTransform: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<Spectrum>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<Spectrum>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Spectrum>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Spectrum> => {
        return signalShortTimeFourierTransform(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the time-frequency view.
 *
 * The columns are the spectra of `useSynchronousShortTimeFourierTransform` with
 * the same framing, and the view retains the hop, the taper and the zero boundary
 * so that it reports frame centre times on the original axis.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framed columns cannot be built.
 */
export let useSynchronousSpectrogram: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Spectrogram> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Spectrogram> => {
    return SynchronousCollector.full<E, Array<E>, Spectrogram>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Spectrogram => {
        return signalSpectrogram(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the analytic signal.
 *
 * The negative-frequency half of the transform is cleared and the positive half is
 * doubled, so each sample becomes `x[n] + i * H(x)[n]` with the envelope as its
 * modulus. The transform is circular, so the two ends of a non-integer-periodic
 * record are contaminated.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousAnalyticSignal: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<Complex>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<Complex>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Complex>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Complex> => {
        return signalAnalyticSignal(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous phases.
 *
 * Each analytic sample becomes its argument in radians, normalised into one turn,
 * so the sequence jumps by a full turn once per cycle.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousInstantaneousPhase: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<Angle>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<Angle>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Angle>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Angle> => {
        return signalInstantaneousPhase(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous envelope.
 *
 * The envelope is the modulus of the analytic signal, which is constant for an
 * unmodulated sinusoid, and it carries the units of the samples.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousEnvelope: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalEnvelope(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous frequencies.
 *
 * The unwrapped analytic phase is differentiated and scaled by `rate / (2 * PI)`.
 * Samples whose envelope, or whose predecessor's envelope, falls below the gate
 * report zero instead of the phase noise that a vanishing envelope produces.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param rate - The sampling rate used to scale the phase step.
 * @param gate - The envelope threshold as a fraction of the peak envelope.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the rate or the gate is not a finite number, or a sample
 *         is not finite.
 * @throws {RangeError} If the rate is not positive, the gate lies outside
 *         `[0, 1]`, or the source is empty.
 */
export let useSynchronousInstantaneousFrequency: <E extends number>(plan: Sample, rate: number, gate: number) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, rate: number, gate: number): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalInstantaneousFrequency(plan, array, rate, gate);
    });
};

/**
 * Creates a collector that finishes with the zero-crossing rate.
 *
 * The rate is the crossing count divided by `count - 1`, so a sine of `f` hertz
 * sampled at `rate` hertz reads `2 * f / rate` and an alternating signal reads
 * one. The optional flag converts it to crossings per second.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param perSecond - Whether to report crossings per second rather than per
 *        sample.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite or the flag is not a boolean.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousZeroCrossingRate: <E extends number>(plan: Sample, perSecond: boolean) => SynchronousCollector<E, Array<E>, number> = <E extends number>(plan: Sample, perSecond: boolean): SynchronousCollector<E, Array<E>, number> => {
    return SynchronousCollector.full<E, Array<E>, number>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): number => {
        return signalZeroCrossingRate(plan, array, perSecond);
    });
};

/**
 * Creates a collector that finishes with the spectral flux sequence.
 *
 * Each frame's one-sided magnitude spectrum is scaled to unit norm and compared
 * with the previous frame, so the value measures spectral shape change rather
 * than loudness. The result holds one value per adjacent frame pair.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framed columns cannot be built.
 */
export let useSynchronousSpectralFlux: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalSpectralFlux(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the auto-correlation profile.
 *
 * The default normalisation divides by the zero-lag sum, so the first value is
 * exactly one and the profile is comparable across signal lengths. The raw sum and
 * the unbiased sum are available as alternatives.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param maximumLag - The largest lag to report.
 * @param normalization - The normalisation rule.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the lag is not an integer, the rule is not supported, or
 *         a sample is not finite.
 * @throws {RangeError} If the lag is negative or not below the source length.
 */
export let useSynchronousAutocorrelation: <E extends number>(plan: Sample, maximumLag: number, normalization: CorrelationNormalization) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, maximumLag: number, normalization: CorrelationNormalization): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalAutocorrelation(plan, array, maximumLag, normalization);
    });
};

/**
 * Creates a collector that finishes with the spectral centroid.
 *
 * The centroid is the power-weighted mean of the one-sided bin frequencies, so a
 * pure tone reports its own frequency. A silent source has no centre of mass and
 * finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralCentroid: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralCentroid(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the spectral bandwidth.
 *
 * The bandwidth is the power-weighted standard deviation of the one-sided bin
 * frequencies around the centroid, so a pure tone reports approximately zero. A
 * silent source finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralBandwidth: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralBandwidth(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the spectral rolloff frequency.
 *
 * The cumulative power over the one-sided half is accumulated in increasing
 * frequency order and the first bin that reaches the requested fraction is
 * reported. A silent source finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @param ratio - The cumulative fraction, within `(0, 1]`.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the ratio or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the ratio lies outside `(0, 1]` or the source is empty.
 */
export let useSynchronousSpectralRolloff: <E extends number>(plan: Sample, window: SpectralWindow, ratio: number) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow, ratio: number): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralRolloff(plan, array, window, ratio);
    });
};

/**
 * Creates a collector that finishes with the spectral flatness.
 *
 * The ratio of the geometric mean to the arithmetic mean of the one-sided power
 * spectrum approaches one for noise and zero for a tone. The definition is over
 * power and over the one-sided half, never over the conjugate mirror.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralFlatness: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, number> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, number> => {
    return SynchronousCollector.full<E, Array<E>, number>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): number => {
        return signalSpectralFlatness(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the signal-to-noise ratio estimate.
 *
 * The noise floor is a quantile of the Welch density, the in-band power is its
 * integral and the result is `10 * log10((band - noise) / noise)`. A band that
 * holds no power above the floor finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The segment length in samples.
 * @param hopSize - The samples between segment starts.
 * @param window - The analysis window.
 * @param floorQuantile - The quantile used as the noise floor, within `(0, 1)`.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length, the window or the quantile is invalid, or a
 *         sample is not finite.
 * @throws {RangeError} If the framing is impossible or the quantile lies outside
 *         `(0, 1)`.
 */
export let useSynchronousSignalToNoiseRatio: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number) => SynchronousCollector<E, Array<E>, Optional<number>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number): SynchronousCollector<E, Array<E>, Optional<number>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<number> => {
        return signalSignalToNoiseRatio(plan, array, frameSize, hopSize, window, floorQuantile);
    });
};

/*
 * ---------------------------------------------------------------------------
 * Spectral transform collectors
 * ---------------------------------------------------------------------------
 *
 * The factories below expose the transform computations of `Sampler` from
 * `#semantic/mathematics/sampler` through the collector protocol. They do not
 * reimplement any algorithm: each finisher delegates to the matching `Sampler`
 * method, so the mathematics module remains the single implementation site.
 *
 * A transform consumes one `Samplable` source (a `Tone`, `Epicycle`, `Waveform`,
 * `Track` or function of time), so each collector must receive exactly one
 * source. The accumulator buffers source descriptors and the finisher applies
 * the transform once, which keeps every piece of computation inside the
 * collector and leaves `Sampler` free of collector concerns.
 */

/**
 * Returns the single source a spectral-transform collector buffered.
 *
 * @param sources - The buffered source descriptors.
 * @param name - The transform name used in the error message.
 * @returns The only source in the buffer.
 * @throws {RangeError} If the buffer does not hold exactly one source.
 */
const singleSourceOf: <S>(sources: Array<S>, name: string) => S =
    <S>(sources: Array<S>, name: string): S => {
        if (sources.length !== 1) {
            throw new RangeError(`${name} collectors require exactly one source.`);
        }
        return sources[0];
    }

/**
 * Creates a collector that finishes with the Sampler's radix-two transform.
 *
 * The algorithm is `Sampler.radix2`: the source is sampled at the sampler's
 * plan and transformed with a pure radix-two decimation, in the mathematics
 * module. The plan's frame count must be a power of two.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         the frame count is not a power of two.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousRadix2: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.radix2(singleSourceOf(sources, "Radix-2 transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's radix-three transform.
 *
 * The algorithm is `Sampler.radix3`, which requires a frame count that is an
 * exact power of three.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         the frame count is not a power of three.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousRadix3: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.radix3(singleSourceOf(sources, "Radix-3 transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's radix-five transform.
 *
 * The algorithm is `Sampler.radix5`, which requires a frame count that is an
 * exact power of five.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         the frame count is not a power of five.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousRadix5: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.radix5(singleSourceOf(sources, "Radix-5 transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's radix-seven transform.
 *
 * The algorithm is `Sampler.radix7`, which requires a frame count that is an
 * exact power of seven.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         the frame count is not a power of seven.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousRadix7: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.radix7(singleSourceOf(sources, "Radix-7 transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's Bluestein transform.
 *
 * The algorithm is `Sampler.blueStein`, which accepts every frame count by
 * padding the convolution internally.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousBlueStein: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.blueStein(singleSourceOf(sources, "Bluestein transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's direct discrete transform.
 *
 * The algorithm is `Sampler.discreteFourierTransform`, the quadratic reference
 * path of the mathematics module.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousDiscreteFourierTransform: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.discreteFourierTransform(singleSourceOf(sources, "Discrete Fourier transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's fastest transform.
 *
 * The algorithm is `Sampler.fastFourierTransform`, which selects the mixed-radix
 * or Bluestein path from the frame count.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousFastFourierTransform: (sampler: Sampler) => SynchronousCollector<Samplable, Array<Samplable>, Spectrum> =
    (sampler: Sampler): SynchronousCollector<Samplable, Array<Samplable>, Spectrum> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Spectrum>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Spectrum => sampler.fastFourierTransform(singleSourceOf(sources, "Fast Fourier transform"))
        );
    };

/**
 * Creates a collector that finishes with the Sampler's wavelet transform.
 *
 * The algorithm is `Sampler.waveletTransform`; the plan's frame count must be a
 * power of two.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @param levels - The number of decomposition levels, defaulting to the maximum.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         the frame count or level count is invalid.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousWaveletTransform: (sampler: Sampler, levels?: number) => SynchronousCollector<Samplable, Array<Samplable>, Array<WaveletLevel>> =
    (sampler: Sampler, levels?: number): SynchronousCollector<Samplable, Array<Samplable>, Array<WaveletLevel>> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Array<WaveletLevel>>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Array<WaveletLevel> => sampler.waveletTransform(singleSourceOf(sources, "Wavelet transform"), levels)
        );
    };

/**
 * Creates a collector that finishes with the Sampler's Laplacian transform.
 *
 * The algorithm is `Sampler.laplacianTransform`, which integrates the source
 * against one exponential kernel per parameter.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @param parameters - The real parameters of the transform.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         a parameter is outside the transform's domain.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousLaplacianTransform: (sampler: Sampler, parameters: Iterable<number>) => SynchronousCollector<Samplable, Array<Samplable>, Array<Complex>> =
    (sampler: Sampler, parameters: Iterable<number>): SynchronousCollector<Samplable, Array<Samplable>, Array<Complex>> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Array<Complex>>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Array<Complex> => sampler.laplacianTransform(singleSourceOf(sources, "Laplacian transform"), parameters)
        );
    };

/**
 * Creates a collector that finishes with the Sampler's Mellin transform.
 *
 * The algorithm is `Sampler.meilinTransform`, which integrates the source
 * against one power kernel per parameter.
 *
 * @param sampler - The sampler whose plan and transform implementation are used.
 * @param parameters - The real parameters of the transform.
 * @returns A reusable collector over one source descriptor.
 * @throws {RangeError} If the collector does not receive exactly one source, or
 *         a parameter is outside the transform's domain.
 * @throws {TypeError} If the source is not a recognised signal or function.
 */
export let useSynchronousMeilinTransform: (sampler: Sampler, parameters: Iterable<number>) => SynchronousCollector<Samplable, Array<Samplable>, Array<Complex>> =
    (sampler: Sampler, parameters: Iterable<number>): SynchronousCollector<Samplable, Array<Samplable>, Array<Complex>> => {
        return SynchronousCollector.full<Samplable, Array<Samplable>, Array<Complex>>(
            (): Array<Samplable> => [],
            (sources: Array<Samplable>, source: Samplable): Array<Samplable> => {
                sources.push(source);
                return sources;
            },
            (sources: Array<Samplable>): Array<Complex> => sampler.meilinTransform(singleSourceOf(sources, "Mellin transform"), parameters)
        );
    };
