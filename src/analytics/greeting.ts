// The greeting at the top of the home tab; a different one each time the tab opens.

const ANY = ['안녕하세요.', '반갑습니다.', '오늘도 힘내세요!', '오늘도 건강한 하루 보내세요.', '꾸준함이 최고의 실력이에요.', '한 걸음씩 쌓이고 있어요.']
const BY_TIME: [number, number, string[]][] = [
  [5, 11, ['좋은 아침이에요.', '상쾌한 아침이에요.']],
  [11, 17, ['좋은 오후예요.', '점심은 잘 챙기셨나요?']],
  [17, 22, ['오늘 하루도 수고 많으셨어요.', '편안한 저녁 보내세요.']],
  [22, 29, ['푹 쉬는 것도 훈련이에요.', '좋은 꿈 꾸세요.']],
]

export function greetingsFor(hour: number): string[] {
  const h = hour < 5 ? hour + 24 : hour
  return [...ANY, ...(BY_TIME.find(([from, to]) => h >= from && h < to)?.[2] ?? [])]
}

/** A random greeting for the hour, not the same as `last` when there is a choice. */
export function pickGreeting(hour: number, last?: string, random = Math.random): string {
  const options = greetingsFor(hour).filter((g) => g !== last)
  return options[Math.floor(random() * options.length)]
}
