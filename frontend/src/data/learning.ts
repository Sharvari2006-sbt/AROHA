export type Flashcard = { front: string; back: string };

export const FLASHCARDS: Flashcard[] = [
  { front: 'What is active recall?', back: 'Trying to retrieve an answer from memory before checking it.' },
  { front: 'What is spaced repetition?', back: 'Reviewing material at increasing intervals so it stays in long-term memory.' },
  { front: 'What does a cell membrane do?', back: 'It controls what enters and leaves the cell.' },
  { front: 'What is 3/4 as a decimal?', back: '0.75' },
  { front: 'What is photosynthesis?', back: 'Plants using light, water and carbon dioxide to make glucose and oxygen.' },
];

export type QuizQuestion = { prompt: string; choices: string[]; answer: number; explain: string };
export type Quiz = { title: string; xp: number; questions: QuizQuestion[] };

export const QUIZZES: Record<string, Quiz> = {
  '1': { title: 'Solar System', xp: 30, questions: [
    { prompt: 'Which planet is closest to the Sun?', choices: ['Earth', 'Mercury', 'Mars', 'Venus'], answer: 1, explain: 'Mercury is the innermost planet.' },
    { prompt: 'Which planet is famous for its rings?', choices: ['Saturn', 'Neptune', 'Earth', 'Mars'], answer: 0, explain: 'Saturn has the most visible ring system.' },
    { prompt: 'What is the Sun?', choices: ['A planet', 'A moon', 'A star', 'An asteroid'], answer: 2, explain: 'The Sun is the star at the centre of our solar system.' },
    { prompt: 'Which planet do we live on?', choices: ['Venus', 'Earth', 'Jupiter', 'Mercury'], answer: 1, explain: 'Earth is our home planet.' },
  ] },
  '2': { title: 'Fractions Fun', xp: 25, questions: [
    { prompt: 'Which fraction means one half?', choices: ['1/3', '2/3', '1/2', '3/4'], answer: 2, explain: 'One of two equal parts is 1/2.' },
    { prompt: 'What is 1/4 + 1/4?', choices: ['1/8', '1/2', '2/3', '1'], answer: 1, explain: 'Two quarters make one half.' },
    { prompt: 'Which is larger?', choices: ['1/4', '3/4', 'They are equal', 'Neither'], answer: 1, explain: 'Three quarters is more than one quarter.' },
    { prompt: 'How many quarters make one whole?', choices: ['2', '3', '4', '5'], answer: 2, explain: 'Four 1/4 pieces make 1.' },
  ] },
  '3': { title: 'Little Words', xp: 20, questions: [
    { prompt: 'Which word rhymes with cat?', choices: ['Dog', 'Hat', 'Sun', 'Bed'], answer: 1, explain: 'Cat and hat share the “at” sound.' },
    { prompt: 'Choose the opposite of big.', choices: ['Huge', 'Tall', 'Small', 'Wide'], answer: 2, explain: 'Small is the opposite of big.' },
    { prompt: 'Which is a naming word?', choices: ['Run', 'Happy', 'Garden', 'Quickly'], answer: 2, explain: 'Garden names a place, so it is a noun.' },
    { prompt: 'Complete: The bird can ___.', choices: ['blue', 'fly', 'soft', 'sky'], answer: 1, explain: 'Fly is the action the bird can do.' },
  ] },
  '4': { title: 'Body & Bones', xp: 25, questions: [
    { prompt: 'Which organ pumps blood?', choices: ['Heart', 'Lungs', 'Stomach', 'Brain'], answer: 0, explain: 'Your heart pumps blood around your body.' },
    { prompt: 'Bones help your body to…', choices: ['Glow', 'Keep its shape', 'Taste', 'Breathe'], answer: 1, explain: 'Your skeleton supports and shapes your body.' },
    { prompt: 'How many lungs do most people have?', choices: ['One', 'Two', 'Three', 'Four'], answer: 1, explain: 'Most people have a left and a right lung.' },
    { prompt: 'Which protects your brain?', choices: ['Ribs', 'Skull', 'Knee', 'Elbow'], answer: 1, explain: 'The skull forms a hard case around the brain.' },
  ] },
};
