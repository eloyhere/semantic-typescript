import { AsynchronousCycle, SynchronousCycle } from "semantic-typescript";
import type { Optional, SynchronousList, AsynchronousList, CycleElement, CycleOptions } from "semantic-typescript";
import type { Angle } from "#semantic/mathematics/angle";
import type { Complex } from "#semantic/mathematics/complex";
import type { Frequency } from "#semantic/mathematics/frequency";

/** A cycle is a list whose extra sampling operations are typed precisely. */
export const cycle = new SynchronousCycle([1, 2]);
export const list: SynchronousList<number> = cycle;
export const element: Optional<CycleElement<number>> = cycle.elementAt(0n);
export const phase: Optional<Angle> = cycle.phaseAt(1n);
export const frequency: Optional<Frequency> = cycle.frequencyAt(1n);
export const phasors: Array<Complex> = cycle.toComplex();
export const phasor: Optional<Complex> = cycle.toComplex(0n);
export const anchor: Angle = cycle.getPhase();

export const asynchronous = new AsynchronousCycle([1]);
export const asynchronousList: AsynchronousList<number> = asynchronous;
export const asynchronousElement: Promise<Optional<CycleElement<number>>> = asynchronous.elementAt(0n);
export const asynchronousPhasors: Promise<Array<Complex>> = asynchronous.toComplex();

/** Options bind the element type of every callback. */
export const options: CycleOptions<number> = { magnitude: (value, index) => value + Number(index) };
export const configured = new SynchronousCycle([1], options);

// @ts-expect-error the index of a sampling operation is a bigint.
cycle.elementAt(0);
// @ts-expect-error a magnitude callback must return a number.
export const badMagnitude: CycleOptions<number> = { magnitude: () => "x" };
// @ts-expect-error a phase option must be an Angle.
export const badPhase: CycleOptions<number> = { phase: 1 };
// @ts-expect-error a frequency option must be a Frequency.
export const badFrequency: CycleOptions<number> = { frequency: 1 };
