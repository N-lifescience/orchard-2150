/** The receipt keeps the complete original effect; the shelf shows a short draft. */
const SUMMARIES: Record<string, string> = {
  hideAndSeek: '부모 둘에게 없던 과육색이나 무늬 모종마다 배수 ×1.5.',
  breedingLog: '골드나 무늬 없는 모종이 점수를 낸 출하마다 배수 +1 누적.',
  punnettNote: '예측을 고른 뒤에 공개된 부모의 자손 분포를 봐요.',
  xHeir: '별다래에서 아비와 잎 색이 같은 암그루마다 배수 +4.',
  karyoScope: '이수성 모종을 받으면 유전자형과 핵형 공개, 솎으면 +$1.',
  scissorRack: '계약을 시작할 때 빈 시약 칸이 있으면 유전자 가위 1개.',
  jellyfishGene: '점수를 낸 형광 모종마다 배수 ×1.5, 계약이 끝날 때 꽃가루 유출 확률 +25%.',
  climateHouse: '특별 규칙을 무시해요. 목표 점수는 같아요.',
  tissueLab: '추가 선발 1개체. 같은 모종을 또 고르면 클론이에요.',
  genetest: '손패나 온실에서 최대 2개체의 유전자형 공개.',
  colchicine: '온실의 2배체 하나를 열매가 큰 4배체로 바꿔요.',
  scissors: '작업대에서 과육색과 쓴맛 DNA를 한 글자씩 고쳐요.',
  vector: '온실의 한 개체에 해파리 형광 유전자를 넣어 LMO로 만들어요.',
  tissue: '빈 온실 칸에 한 개체를 복제해요.',
  fertilizer: '손패 최대 2개체의 당도 +2. 이번 주문만, 유전 안 됨.',
  brush: '출하 중 재교배해요. 출하와 솎아내기 잔여 횟수는 같아요.',
};
export function shopSummary(id: string, original: string): string { return SUMMARIES[id] ?? original; }
