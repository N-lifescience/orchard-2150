// 유전 엔진 입구. src/contract/genetics.ts 의 GeneticsApi 이름을 전부 named export 한다.
import type { GeneticsApi } from '../contract/genetics';
import { CODON_TABLE, templateStrand, transcribe, translate } from './codons';
import { cloneGenome } from './genome';
import { addTransgene, canCross, doubleGenome, fertilize, makePod, meiosis } from './meiosis';
import { describeGenotype, formatGenotype, parseGenotype } from './parse';
import { expectedDistribution, inferableLoci, isHeterozygous, phenotype, suitOf } from './phenotype';
import { makeRng } from './rng';
import { analyzeCoding, codingSeq, editCoding } from './sequence';
import { SPECIES } from './species';

export {
  SPECIES,
  CODON_TABLE,
  makeRng,
  parseGenotype,
  formatGenotype,
  describeGenotype,
  cloneGenome,
  meiosis,
  fertilize,
  canCross,
  makePod,
  phenotype,
  suitOf,
  isHeterozygous,
  inferableLoci,
  doubleGenome,
  addTransgene,
  codingSeq,
  editCoding,
  analyzeCoding,
  transcribe,
  templateStrand,
  translate,
  expectedDistribution,
};

/** 계약 전체를 한 객체로 (타입 검사로 계약과 어긋나지 않음을 보증한다) */
export const genetics: GeneticsApi = {
  SPECIES,
  CODON_TABLE,
  makeRng,
  parseGenotype,
  formatGenotype,
  describeGenotype,
  cloneGenome,
  meiosis,
  fertilize,
  canCross,
  makePod,
  phenotype,
  suitOf,
  isHeterozygous,
  inferableLoci,
  doubleGenome,
  addTransgene,
  codingSeq,
  editCoding,
  analyzeCoding,
  transcribe,
  templateStrand,
  translate,
  expectedDistribution,
};
