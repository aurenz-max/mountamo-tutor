## Per cell

| Objective | Arm | Level | n | Judge % correct | Judge steps | Largest number | Labelled hard |
|---|---|---|---|---|---|---|---|
| add20 | prompt | L1 | 6 | 90.3 | 1.0 | 9.2 | 0/6 |
| add20 | prompt | L2 | 6 | 73.7 | 1.5 | 12.2 | 2/6 |
| add20 | prompt | L3 | 6 | 57.0 | 2.2 | 11.8 | 6/6 |
| add20 | struct | L1 | 6 | 92.5 | 1.0 | 6.0 | 0/6 |
| add20 | struct | L2 | 6 | 75.7 | 1.5 | 9.7 | 3/6 |
| add20 | struct | L3 | 6 | 60.2 | 2.0 | 15.5 | 4/6 |
| mult100 | prompt | L1 | 6 | 73.3 | 1.0 | 8.0 | 0/6 |
| mult100 | prompt | L2 | 6 | 78.0 | 1.2 | 42.3 | 0/6 |
| mult100 | prompt | L3 | 6 | 49.3 | 2.7 | 32.7 | 6/6 |
| mult100 | struct | L1 | 6 | 89.5 | 1.0 | 41.5 | 0/6 |
| mult100 | struct | L2 | 6 | 81.5 | 1.0 | 31.7 | 0/6 |
| mult100 | struct | L3 | 6 | 73.3 | 2.0 | 31.7 | 0/6 |
| habitat | prompt | L1 | 6 | 90.7 | 1.0 | - | 0/6 |
| habitat | prompt | L2 | 6 | 89.2 | 1.0 | - | 0/6 |
| habitat | prompt | L3 | 6 | 76.3 | 2.0 | - | 5/6 |
| habitat | struct | L1 | 6 | 94.2 | 1.0 | - | 0/6 |
| habitat | struct | L2 | 6 | 87.7 | 1.5 | - | 0/6 |
| habitat | struct | L3 | 6 | 79.8 | 2.0 | - | 0/6 |

## Pairwise L1 vs L3

| Objective | Arm | L3 judged harder | L1 judged harder | same |
|---|---|---|---|---|
| add20 | prompt | 6 | 0 | 0 |
| add20 | struct | 6 | 0 | 0 |
| mult100 | prompt | 6 | 0 | 0 |
| mult100 | struct | 6 | 0 | 0 |
| habitat | prompt | 6 | 0 | 0 |
| habitat | struct | 6 | 0 | 0 |

## One item per cell

- **add20 prompt L1** (judge 92%, 1 steps): What is 10 plus 6? → 16
- **add20 prompt L3** (judge 58%, 2 steps): Why does 9 + 5 have the same answer as 10 + 4? → One moved to make ten.
- **add20 struct L1** (judge 88%, 1 steps): What is 10 - 7? → 3
- **add20 struct L3** (judge 68%, 2 steps): Which number makes this true? ___ + 9 = 17 → 8
- **mult100 prompt L1** (judge 72%, 1 steps): What is 7 × 8? → 56
- **mult100 prompt L3** (judge 48%, 3 steps): What would happen to the number of boxes needed if Maya packs 24 cookies into boxes of 6 instead of boxes of 3? → She would need half as many boxes because doubling the cookies in each box cuts the number of boxes in half.
- **mult100 struct L1** (judge 85%, 1 steps): Leo has 40 stickers to share equally among 5 gift bags. How many stickers go into each bag? → 8
- **mult100 struct L3** (judge 74%, 2 steps): A teacher has 7 packs of stickers with 8 stickers in each pack. She gives away 44 stickers to her class. What is 7 × 8 - 44? → 12
- **habitat prompt L1** (judge 92%, 1 steps): Which body part helps a fish breathe underwater? → Gills
- **habitat prompt L3** (judge 72%, 2 steps): Why does a desert fennec fox have very large ears, while an Arctic fox has tiny, rounded ears? → Large ears let extra body heat escape into the air, while tiny ears help keep heat inside.
- **habitat struct L1** (judge 94%, 1 steps): Which body part does a duck use to paddle and swim across a pond? → Webbed feet
- **habitat struct L3** (judge 86%, 2 steps): A shallow marsh dries up during a long summer drought, leaving behind hard, dry ground. Animal 1 is a duck with webbed feet, and Animal 2 is a lizard with sharp claws. Which animal is more likely to move around easily to find food? → The lizard, because sharp claws grip hard, dry ground.
