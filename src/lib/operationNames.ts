const ADJECTIVES = [
  'Bold', 'Swift', 'Silent', 'Lethal', 'Covert', 'Feral', 'Caffeinated', 'Sneaky',
  'Tactical', 'Reluctant', 'Unhinged', 'Discreet', 'Slippery', 'Ambitious',
  'Sleepy', 'Furious', 'Polite', 'Rogue', 'Stealthy', 'Chaotic', 'Professional',
  'Suspicious', 'Motivated', 'Overconfident',
]

const VERBS = [
  'Bumble', 'Waddle', 'Sprint', 'Snack', 'Flank', 'Pivot', 'Deploy', 'Salute',
  'Panic', 'Nap', 'Scramble', 'Assault', 'Retrieve', 'Vibe', 'Crawl', 'Maneuver',
  'Skirmish', 'Withdraw', 'Hunker', 'Improvise', 'Patrol', 'Pounce', 'Shuffle', 'Snooze',
]

export function generateOperationName(previous?: string): string {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const verb = VERBS[Math.floor(Math.random() * VERBS.length)]
    const name = `Operation ${adjective} ${verb}`
    if (name !== previous) return name
  }
  return 'Operation Tactical Snack'
}
