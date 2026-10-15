# Recovery Algorithm & Daily Schedule Rules

Original spec. The implementation in `src/engine.js` follows these weights and archetypes, and adds personal rolling baselines and data-driven directions on top.

## 1. Recovery score weighting (0–100%)

- Sleep (duration + quality): 35%
- HRV & resting heart rate: 35%
- Muscle soreness & joint stiffness: 20%
- Mental energy / fatigue: 10%

## 2. Day archetypes

### A. High Output Day (score ≥ 80%)

Heavy hypertrophy training, football, high-intensity deep work.

- 07:00 Morning sun & hydration
- 07:30 10-min dynamic warm-up
- 09:00–11:00 Deep focus study/engineering block (2 h)
- 17:00 Heavy lifting or football
- 21:30 Wind-down & recovery

### B. Balanced Flow Day (50–79%)

Moderate training, structured work, mobility maintenance.

- 07:30 15-min ankle & hip mobility
- 09:00–12:00 Structured work / meetings
- 14:00 15-min breathwork / meditation
- 17:30 Standard hypertrophy workout (technique focus)

### C. Active Restoration Day (< 50%)

Parasympathetic activation, active recovery, errands, light study.

- 08:00 Gentle walk & hydration
- 09:00 20-min deep meditation & breathwork
- 10:30 Passive study / reading
- 14:00 Grocery shopping & meal prep
- 16:30 30-min full mobility & foam rolling
