import type { Phenotype } from '../contract/genetics';

// Each visible color/mark/sex combination has its own generated illustration.
// Literal URLs let Vite fingerprint the files and keep relative hosting paths working.
const images = {
  'lumi-ruby-plain': new URL('./assets/lumi-ruby-plain.webp', import.meta.url).href,
  'lumi-ruby-marked': new URL('./assets/lumi-ruby-marked.webp', import.meta.url).href,
  'lumi-gold-plain': new URL('./assets/lumi-gold-plain.webp', import.meta.url).href,
  'lumi-gold-marked': new URL('./assets/lumi-gold-marked.webp', import.meta.url).href,
  'stella-female-ruby-green': new URL('./assets/stella-female-ruby-green.webp', import.meta.url).href,
  'stella-female-ruby-silver': new URL('./assets/stella-female-ruby-silver.webp', import.meta.url).href,
  'stella-female-gold-green': new URL('./assets/stella-female-gold-green.webp', import.meta.url).href,
  'stella-female-gold-silver': new URL('./assets/stella-female-gold-silver.webp', import.meta.url).href,
  'stella-female-ruby-green-seedless': new URL('./assets/stella-female-ruby-green-seedless.webp', import.meta.url).href,
  'stella-female-ruby-silver-seedless': new URL('./assets/stella-female-ruby-silver-seedless.webp', import.meta.url).href,
  'stella-female-gold-green-seedless': new URL('./assets/stella-female-gold-green-seedless.webp', import.meta.url).href,
  'stella-female-gold-silver-seedless': new URL('./assets/stella-female-gold-silver-seedless.webp', import.meta.url).href,
  'stella-male-ruby-green': new URL('./assets/stella-male-ruby-green.webp', import.meta.url).href,
  'stella-male-ruby-silver': new URL('./assets/stella-male-ruby-silver.webp', import.meta.url).href,
  'stella-male-gold-green': new URL('./assets/stella-male-gold-green.webp', import.meta.url).href,
  'stella-male-gold-silver': new URL('./assets/stella-male-gold-silver.webp', import.meta.url).href,
} as const;

export function plantImageUrl(p: Phenotype): string {
  if (p.species === 'lumi') {
    return images[`lumi-${p.color}-${p.marked ? 'marked' : 'plain'}`];
  }
  if (p.sex !== 'M' && p.seedless) {
    return images[`stella-female-${p.color}-${p.marked ? 'silver' : 'green'}-seedless`];
  }
  return images[`stella-${p.sex === 'M' ? 'male' : 'female'}-${p.color}-${p.marked ? 'silver' : 'green'}`];
}
