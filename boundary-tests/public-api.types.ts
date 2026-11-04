import { useOf, useFrom } from 'semantic-typescript';
// Public README examples: zero, one, and many values must be callable in TypeScript.
const empty = useOf<number>();
const one = useOf(1);
const many = useOf(1, 2, 3);
const projected = useOf({ price: 10 }, { price: 30 }).toNumericStatistics().average(item => item.price);
const chars = useFrom('A😊B');
void [empty, one, many, projected, chars];
