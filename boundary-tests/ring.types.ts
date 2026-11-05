import { AsynchronousRing, SynchronousRing } from "semantic-typescript";
import type { Optional, SynchronousList, AsynchronousList, RingElement, RingOptions } from "semantic-typescript";
import type { Angle } from "#semantic/mathematics/angle";
import type { Complex } from "#semantic/mathematics/complex";
import type { Frequency } from "#semantic/mathematics/frequency";

/** A ring is a list whose extra sampling operations are typed precisely. */
export const ring = new SynchronousRing([1, 2]);
export const list: SynchronousList<number> = ring;
export const element: Optional<RingElement<number>> = ring.elementAt(0n);
export const phase: Optional<Angle> = ring.phaseAt(1n);
export const frequency: Optional<Frequency> = ring.frequencyAt(1n);
export const phasors: Array<Complex> = ring.toComplex();
export const phasor: Optional<Complex> = ring.toComplex(0n);
export const anchor: Angle = ring.getPhase();

export const asynchronous = new AsynchronousRing([1]);
export const asynchronousList: AsynchronousList<number> = asynchronous;
export const asynchronousElement: Promise<Optional<RingElement<number>>> = asynchronous.elementAt(0n);
export const asynchronousPhasors: Promise<Array<Complex>> = asynchronous.toComplex();

/** Options bind the element type of every callback. */
export const options: RingOptions<number> = { magnitude: (value, index) => value + Number(index) };
export const configured = new SynchronousRing([1], options);

// @ts-expect-error the index of a sampling operation is a bigint.
ring.elementAt(0);
// @ts-expect-error a magnitude callback must return a number.
export const badMagnitude: RingOptions<number> = { magnitude: () => "x" };
// @ts-expect-error a phase option must be an Angle.
export const badPhase: RingOptions<number> = { phase: 1 };
// @ts-expect-error a frequency option must be a Frequency.
export const badFrequency: RingOptions<number> = { frequency: 1 };
