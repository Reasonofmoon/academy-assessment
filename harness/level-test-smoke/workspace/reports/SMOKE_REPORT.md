# Level-test smoke report (agent-solved)

- **Generated:** 2026-08-05T14:22:00.078209+00:00
- **Harness:** level-test-smoke
- **Overall:** `pass`
- **Accuracy:** 130/132 = **98%**
- **Execution:** logical sequential lanes; Gemini solves without gold

## Level matrix

| Level | Verdict | Correct | Total | Accuracy |
|---|---|---:|---:|---:|
| L1 | **pass** | 20 | 20 | 100% |
| L2 | **pass** | 35 | 37 | 95% |
| L3 | **pass** | 20 | 20 | 100% |
| L4 | **pass** | 18 | 18 | 100% |
| L5 | **pass** | 19 | 19 | 100% |
| L6 | **pass** | 18 | 18 | 100% |

## Item-by-item

### L1

- ✓ `grammar-L1-fill-msfwxxgr-3` [grammar] chosen=1 gold=1 · OK
  - note: The subject 'She' is third-person singular, which requires the verb 'is' for the present tense of 'to be'.
- ✓ `grammar-L1-fill-msfwxxgr-4` [grammar] chosen=1 gold=1 · OK
  - note: The subject 'He' is third-person singular, and the adverb 'often' indicates a habitual action, requiring the simple present tense. For third-person singular sub
- ✓ `grammar-L1-fill-msfwxxgr-5` [grammar] chosen=1 gold=1 · OK
  - note: The preposition 'on' is used to indicate that an object is resting on the surface of another object. In this case, the book is resting on the surface of the tab
- ✓ `grammar-L1-fill-msfy25cu-3` [grammar] chosen=0 gold=0 · OK
  - note: The subject 'My dog' is singular (third person), which requires the present tense form 'is' for the verb 'to be'. Options 1, 2, and 3 use incorrect forms ('are'
- ✓ `grammar-L1-fill-msfy25cu-4` [grammar] chosen=2 gold=2 · OK
  - note: Option 2 uses the correct subjective pronoun 'She' as the subject and the correct objective pronoun 'him' as the object of the verb 'likes'. Options 0, 1, and 3
- ✓ `grammar-L1-fill-msfy25cu-5` [grammar] chosen=2 gold=2 · OK
  - note: Option 2 correctly applies subject-verb agreement for the third-person singular subject 'He' with the present tense verb 'eats'. Options 0, 1, and 3 contain sub
- ✓ `reading-L1-elem-msg0um01-0` [reading] chosen=0 gold=0 · OK
  - note: The passage introduces Max, describes him, talks about daily activities with him, and expresses love for him. All these details revolve around 'My pet dog, Max,
- ✓ `reading-L1-elem-msg0um01-1` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states, "Mina likes art class the most."
- ✓ `reading-L1-elem-msg0um01-2` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states, 'It is a happy day.'
- ✓ `reading-L1-elem-msg0um01-3` [reading] chosen=0 gold=0 · OK
  - note: The passage introduces Tom, describes his characteristics, actions, and the writer's feelings about him, all of which serve to describe Tom.
- ✓ `reading-L1-elem-msg0um01-4` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'I can borrow two books for one week.'
- ✓ `reading-L1-fill-msfy25cu-6` [reading] chosen=0 gold=0 · OK
  - note: The passage introduces the writer's dog, Max, describes his appearance, daily activities with him, and the writer's affection for him. All details revolve aroun
- ✓ `reading-L1-fill-msfy25cu-7` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states, 'Mina likes art class the most.'
- ✓ `reading-L1-fill-msfy25cu-8` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'On rainy days, we stay home.' It also mentions, 'After school, I walk with Max in the park.' If they stay home on rainy days, they do not w
- ✓ `vocabulary-L1-fill-msfwxxgr-0` [vocabulary] chosen=1 gold=1 · OK
  - note: The Korean word '행복한' translates directly to 'happy' in English.
- ✓ `vocabulary-L1-fill-msfwxxgr-1` [vocabulary] chosen=0 gold=0 · OK
  - note: In the sentence 'The boy can run very fast,' 'run' refers to the physical act of moving quickly on foot, which is '달리다' in Korean.
- ✓ `vocabulary-L1-fill-msfwxxgr-2` [vocabulary] chosen=0 gold=0 · OK
  - note: Apples are typically eaten, making 'Eat' the most appropriate verb for the sentence.
- ✓ `vocabulary-L1-fill-msfy25cu-0` [vocabulary] chosen=1 gold=1 · OK
  - note: The Korean word '먹다' translates to 'eat' in English.
- ✓ `vocabulary-L1-fill-msfy25cu-1` [vocabulary] chosen=1 gold=1 · OK
  - note: The word 'happy' directly translates to '행복한' in Korean. The sentence 'I feel very happy today' expresses a feeling of happiness.
- ✓ `vocabulary-L1-fill-msfy25cu-2` [vocabulary] chosen=2 gold=2 · OK
  - note: Dogs are known for their ability to run, and 'fast' is an appropriate adverb to describe how a dog runs.

### L2

- ✓ `grammar-1` [grammar] chosen=1 gold=1 · OK
  - note: The subject 'My brother' is third-person singular, and the adverb 'often' indicates a habitual action, requiring the simple present tense verb form 'plays'.
- ✓ `grammar-1-2` [grammar] chosen=1 gold=1 · OK
  - note: The word 'now' indicates an action happening at the present moment, which requires the present continuous tense (is/am/are + -ing).
- ✗ `grammar-2` [grammar] chosen=0 gold=2 · KEY_MISMATCH
  - note: Wearing a helmet is a critical safety measure, often a legal requirement or a strong necessity, which 'must' conveys more strongly than 'should'.
- ✓ `grammar-2-2` [grammar] chosen=1 gold=1 · OK
  - note: Water is an uncountable noun, and 'much' is used to quantify uncountable nouns in questions.
- ✓ `grammar-3` [grammar] chosen=2 gold=2 · OK
  - note: For specific times like '7 p.m.', we use 'at'. For specific days of the week like 'Friday', we use 'on'. Thus, 'at 7 p.m. on Friday' is correct.
- ✓ `grammar-3-2` [grammar] chosen=1 gold=1 · OK
  - note: For multi-syllable adjectives like 'interesting', the comparative form is created by using 'more' before the adjective, not by adding '-er'. The word 'than' ind
- ✓ `grammar-4` [grammar] chosen=1 gold=1 · OK
  - note: The blank requires an adverb to modify the verb 'speaks'. 'Well' is the adverbial form of 'good', while 'good' is an adjective.
- ✓ `grammar-4-2` [grammar] chosen=2 gold=2 · OK
  - note: The preposition 'at' is used for specific times, such as 'at 7 o'clock'.
- ✓ `grammar-5` [grammar] chosen=2 gold=2 · OK
  - note: The question asks to choose the sentence where 'should' is used naturally. 'You should go to bed early' is a common way to give advice or make a recommendation,
- ✓ `grammar-L2-fill-msfy2rbz-3` [grammar] chosen=2 gold=2 · OK
  - note: The first blank describes a habitual action ('usually'), requiring the simple present tense ('walks'). The second blank describes a temporary action happening '
- ✓ `grammar-L2-fill-msfy2rbz-4` [grammar] chosen=1 gold=1 · OK
  - note: For specific dates like 'July 20th', we use the preposition 'on'. For specific times like '7 PM', we use the preposition 'at'. Therefore, 'on / at' is the corre
- ✓ `grammar-L2-fill-msfy2rbz-5` [grammar] chosen=3 gold=3 · OK
  - note: The singular subject 'The dog' correctly agrees with the singular verb 'is sleeping'.
- ✓ `reading-1` [reading] chosen=0 gold=0 · OK
  - note: The letter's primary purpose is for Michael's mother to explain why he couldn't complete Ms. White's homework and to request an extension for its submission.
- ✓ `reading-1-2` [reading] chosen=0 gold=0 · OK
  - note: The letter explicitly asks for an extension for Michael's homework submission until next Monday.
- ✓ `reading-2` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'when I received my bank statement, I discovered that you charged my card twice.' Option 0 accurately reflects this problem.
- ✗ `reading-2-2` [reading] chosen=2 gold=0 · KEY_MISMATCH,HIGH_CONF_WRONG
  - note: The passage states that the initial cost for two tickets was $44, but the writer's card was charged twice. Therefore, the total amount paid was $44 * 2 = $88.
- ✓ `reading-3` [reading] chosen=0 gold=0 · OK
  - note: The letter asks Ms. White for an extension on 'your homework,' indicating she is Michael's teacher.
- ✓ `reading-3-2` [reading] chosen=0 gold=0 · OK
  - note: The letter mentions "your homework," indicating Ms. White is the teacher who assigned Michael's homework.
- ✓ `reading-4` [reading] chosen=0 gold=0 · OK
  - note: The letter states the customer was charged twice for a single purchase and asks for the matter to be resolved, which implies a request for a refund for the over
- ✓ `reading-4-2` [reading] chosen=0 gold=0 · OK
  - note: The letter explicitly states that the writer was charged twice and requests that the matter be resolved quickly, indicating a request for a refund.
- ✓ `reading-5` [reading] chosen=0 gold=0 · OK
  - note: The passage states Michael completed science, math, and English, but not history.
- ✓ `reading-L2-fill-msfy2rbz-6` [reading] chosen=0 gold=0 · OK
  - note: 편지는 Michael이 숙제를 제시간에 끝내지 못한 이유를 설명하고, 숙제 제출 기한을 다음 월요일로 연장해 줄 것을 요청하고 있습니다.
- ✓ `reading-L2-fill-msfy2rbz-7` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states, 'when I received my bank statement, I discovered that you charged my card twice.'
- ✓ `reading-L2-fill-msfy2rbz-8` [reading] chosen=0 gold=0 · OK
  - note: The passage states Michael 'worked hard all evening' and was 'anxious to finish your homework,' indicating his usual effort to complete assignments.
- ✓ `vocabulary-1` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean meaning '도착하다, 도달하다' translates to 'to arrive' or 'to reach', which directly matches the English word 'Arrive'.
- ✓ `vocabulary-1-2` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean word '여정' (yeojeong) specifically translates to 'journey', which also encompasses the broader meaning of '여행' (travel).
- ✓ `vocabulary-2` [vocabulary] chosen=0 gold=0 · OK
  - note: In the context of 'board game', 'board' refers to the flat surface or '판' on which the game is played.
- ✓ `vocabulary-2-2` [vocabulary] chosen=0 gold=0 · OK
  - note: In the context of a restaurant, 'serve' means to provide or offer food.
- ✓ `vocabulary-4` [vocabulary] chosen=0 gold=0 · OK
  - note: The phrase 'collect stamps' is the standard and most appropriate term for the hobby of gathering stamps from various countries.
- ✓ `vocabulary-4-2` [vocabulary] chosen=0 gold=0 · OK
  - note: The adverb 'suddenly' best describes an unexpected or quick emergence from behind an object.
- ✓ `vocabulary-5` [vocabulary] chosen=0 gold=0 · OK
  - note: Option 0 uses 'practice' correctly as a verb meaning to repeatedly perform an activity to improve skill, and the sentence is grammatically sound. Option 1 has a
- ✓ `vocabulary-L2-extra-msfvg41p-0` [vocabulary] chosen=0 gold=0 · OK
  - note: In the context of 'paying a large fine for parking illegally,' 'fine' refers to a monetary penalty. '벌금' (beolgeum) means 'fine' as in a penalty.
- ✓ `vocabulary-L2-extra-msfvg41p-1` [vocabulary] chosen=0 gold=0 · OK
  - note: To safeguard the environment from the harmful effects of pollution, we must protect it.
- ✓ `vocabulary-L2-fill-msfy2rbz-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean word '도착하다' directly translates to 'Arrive' in English.
- ✓ `vocabulary-L2-fill-msfy2rbz-1` [vocabulary] chosen=0 gold=0 · OK
  - note: In the sentence 'The project will last for a long period of time,' 'period' refers to a duration or stretch of time. Option 0, '기간, 시기' (duration, time/period),
- ✓ `vocabulary-L2-fill-msfy2rbz-2` [vocabulary] chosen=0 gold=0 · OK
  - note: The phrase 'before I can play' indicates that the homework must be completed first. 'Finish' means to complete something, making it the most logical choice.
- ✓ `vocabulary-L2-replace-msfvg3on` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean words '제안하다', '제의하다', and '암시하다' all translate directly to 'suggest' in English.

### L3

- ✓ `grammar-1-3` [grammar] chosen=0 gold=0 · OK
  - note: The subject of the sentence is 'One', which is singular, therefore requiring the singular verb form 'is'. The phrase 'of the students' is a prepositional phrase
- ✓ `grammar-2-3` [grammar] chosen=0 gold=0 · OK
  - note: The antecedent 'My brother' is a person, and the clause '___ lives in London' is a non-restrictive clause (set off by commas). 'Who' is the correct relative pro
- ✓ `grammar-3-3` [grammar] chosen=0 gold=0 · OK
  - note: The sentence is a second conditional, which uses the past simple in the 'if' clause and 'would + base verb' in the main clause to express an unreal or hypotheti
- ✓ `grammar-4-3` [grammar] chosen=0 gold=0 · OK
  - note: The phrase 'next year' indicates a future event, and 'The new bridge' is the recipient of the action 'build', requiring a passive voice. 'will be built' correct
- ✓ `grammar-L3-fill-msfy3v8j-3` [grammar] chosen=2 gold=2 · OK
  - note: This is a second conditional sentence expressing an unreal or hypothetical situation. In such cases, the subjunctive mood 'were' is used for all persons in the 
- ✓ `grammar-L3-fill-msfy3v8j-4` [grammar] chosen=1 gold=1 · OK
  - note: The blank requires a subject pronoun to introduce a relative clause modifying 'The woman'. 'Who' is the correct subject pronoun for people.
- ✓ `grammar-L3-fill-msfy3v8j-5` [grammar] chosen=2 gold=2 · OK
  - note: The phrase 'for five years' indicates a duration that started in the past and continues up to the present. The present perfect tense ('has lived') is the correc
- ✓ `reading-1-3` [reading] chosen=0 gold=0 · OK
  - note: The passage provides multiple examples (chocolates, trips) and introduces the concept of 'tyranny of choice' to illustrate that a wider range of choices can lea
- ✓ `reading-2-3` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'the apple butter forced me to make several stops during the marathon.'
- ✓ `reading-3-3` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states that 'tyranny of choice' means it 'constrains our decision-making' rather than providing freedom, and leads to increased fear of m
- ✓ `reading-4-3` [reading] chosen=0 gold=0 · OK
  - note: The author uses a personal anecdote to provide direct advice on what foods to eat and avoid before a race.
- ✓ `reading-L3-fill-msfy3v8j-6` [reading] chosen=0 gold=0 · OK
  - note: The passage explains how an abundance of choices, contrary to intuition, often leads to dissatisfaction and regret, which is the core idea of 'the paradox of ch
- ✓ `reading-L3-fill-msfy3v8j-7` [reading] chosen=0 gold=0 · OK
  - note: The author explicitly states, 'I concentrate on foods that are part of my normal diet' and advises, 'These foods are the ones you should concentrate on before a
- ✓ `reading-L3-fill-msfy3v8j-8` [reading] chosen=1 gold=1 · OK
  - note: The passage explicitly states that choice forces comparisons, highlights disadvantages, and leads to regret, ultimately making people less happy.
- ✓ `vocabulary-1-3` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '달성하다' and '성취하다' both mean 'to achieve' or 'to accomplish' in English.
- ✓ `vocabulary-2-3` [vocabulary] chosen=1 gold=1 · OK
  - note: In the context of a smartphone, 'features' refers to its distinctive attributes, characteristics, or functions. Option 1, '주요 특징 또는 기능' (main characteristic or 
- ✓ `vocabulary-4-3` [vocabulary] chosen=1 gold=1 · OK
  - note: Exploring an old castle is a common and logical activity to learn about its history and architecture.
- ✓ `vocabulary-L3-fill-msfy3v8j-0` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '성취하다' and '달성하다' both mean 'to achieve' or 'to accomplish' in English.
- ✓ `vocabulary-L3-fill-msfy3v8j-1` [vocabulary] chosen=0 gold=0 · OK
  - note: In the sentence 'The main issue in the debate was climate change,' 'issue' refers to the primary topic or problem being discussed. Option 0, '문제점이나 논쟁의 주제' (pro
- ✓ `vocabulary-L3-fill-msfy3v8j-2` [vocabulary] chosen=0 gold=0 · OK
  - note: Water is absolutely necessary for the survival of all living things, making 'essential' the most fitting word.

### L4

- ✓ `grammar-L4-fill-msfwz4fx-2` [grammar] chosen=0 gold=0 · OK
  - note: This is a Type 2 conditional sentence (unreal present/future). The structure is 'If + Simple Past, would + Base Verb'. 'If I had more time' uses the simple past
- ✓ `grammar-L4-fill-msfwz4fx-3` [grammar] chosen=1 gold=1 · OK
  - note: The relative pronoun functions as the object of the verb 'met' in the clause 'I met yesterday'. For people, the objective case of the relative pronoun is 'whom'
- ✓ `grammar-L4-fill-msfwz4fx-4` [grammar] chosen=0 gold=0 · OK
  - note: The verb 'enjoy' is typically followed by a gerund (the -ing form of a verb).
- ✓ `grammar-L4-fill-msfy4u5x-2` [grammar] chosen=0 gold=0 · OK
  - note: The sentence 'I would travel the world' uses 'would + base verb', indicating a second conditional (unreal present/future). In a second conditional, the 'if' cla
- ✓ `grammar-L4-fill-msfy4u5x-3` [grammar] chosen=0 gold=0 · OK
  - note: The relative pronoun needs to refer to 'The student' (a person) and act as the subject of the verb 'won' in the relative clause. 'Who' is the correct subject pr
- ✓ `grammar-L4-fill-msfy4u5x-4` [grammar] chosen=0 gold=0 · OK
  - note: The verb 'enjoy' is typically followed by a gerund (the -ing form of a verb). Therefore, 'learning' is the correct form.
- ✓ `reading-L4-fill-msfwz4fx-5` [reading] chosen=0 gold=0 · OK
  - note: The passage contrasts the pre-programmed brains of other mammals (leading to quick independence but limited adaptability) with the 'remarkably incomplete' and '
- ✓ `reading-L4-fill-msfwz4fx-6` [reading] chosen=0 gold=0 · OK
  - note: The passage states that memories are 'coloured by their family’s constructs system' and 'interpreted within their respective family of origin’s construct system
- ✓ `reading-L4-fill-msfwz4fx-7` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'This is possible because the human brain is born remarkably incomplete.' It then contrasts this with 'hardwired' animal brains, explaining 
- ✓ `reading-L4-fill-msfy4u5x-5` [reading] chosen=0 gold=0 · OK
  - note: The passage explains that human's long period of helplessness (long infancy) is not a weakness but an evolutionary strategy that allows the brain to be 'livewir
- ✓ `reading-L4-fill-msfy4u5x-6` [reading] chosen=3 gold=3 · OK
  - note: The passage states that memories are 'selective and coloured by their family’s constructs system' and that stories are 'interpreted within their respective fami
- ✓ `reading-L4-fill-msfy4u5x-7` [reading] chosen=0 gold=0 · OK
  - note: The passage states that a 'preprogrammed brain' 'trades off with flexibility' and that an animal with such a brain 'would have no capacity to adapt' if placed '
- ✓ `vocabulary-L4-fill-msfwz4fx-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean words '근면한, 성실한' mean diligent and sincere, and 'Diligent' is the best match among the options.
- ✓ `vocabulary-L4-fill-msfwz4fx-1` [vocabulary] chosen=0 gold=0 · OK
  - note: The word 'foster' in the context of 'foster a love of learning' means to encourage the development or growth of something. '육성하다' (yuksseonghada) directly trans
- ✓ `vocabulary-L4-fill-msfx1nfr-0` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '성실한' and '부지런한' both mean diligent or hardworking, which directly corresponds to the English word 'Diligent'.
- ✓ `vocabulary-L4-fill-msfx1nfr-1` [vocabulary] chosen=0 gold=0 · OK
  - note: A severe drought would naturally have a negative 'consequence' or effect on agriculture, making 'devastating consequence' the most fitting phrase.
- ✓ `vocabulary-L4-fill-msfy4u5x-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean words '회복력' and '탄력성' directly translate to 'resilience' in English, meaning the ability to recover quickly from difficulties.
- ✓ `vocabulary-L4-fill-msfy4u5x-1` [vocabulary] chosen=0 gold=0 · OK
  - note: The word 'underscore' means to emphasize or highlight. In the given sentence, the economic downturn serves to emphasize the importance of financial prudence. Op

### L5

- ✓ `grammar-L5-fill-msfx02ht-2` [grammar] chosen=0 gold=0 · OK
  - note: The preposition 'on' must be followed by a gerund (the -ing form of a verb). Therefore, 'going' is the correct choice.
- ✓ `grammar-L5-fill-msfx02ht-3` [grammar] chosen=1 gold=1 · OK
  - note: The clause 'I grew up' describes the place (the house) where the action occurred. 'Where' is a relative adverb used to introduce a relative clause that modifies
- ✓ `grammar-L5-fill-msfx02ht-4` [grammar] chosen=1 gold=1 · OK
  - note: This is a second conditional sentence expressing a hypothetical situation. In such 'if' clauses, the subjunctive mood 'were' is used for all subjects, including
- ✓ `grammar-L5-fill-msfy5oes-3` [grammar] chosen=1 gold=1 · OK
  - note: The phrase 'by extensive research' indicates that the research is the agent performing the action of supporting. Therefore, the findings are the recipient of th
- ✓ `grammar-L5-fill-msfy5oes-4` [grammar] chosen=1 gold=1 · OK
  - note: The sentence uses a parallel structure with gerunds ('managing', 'coordinating'), so the final item must also be a gerund ('overseeing') to maintain consistency
- ✓ `grammar-L5-fill-msfy5oes-5` [grammar] chosen=0 gold=0 · OK
  - note: The main clause 'the proposal would have been implemented immediately' indicates a past unreal consequence. This requires a past unreal condition. Option 0, 'Ha
- ✓ `reading-L5-fill-msfx02ht-5` [reading] chosen=0 gold=0 · OK
  - note: The passage provides numerous examples and explanations of different idioms that use the word 'hand', showcasing their varied meanings.
- ✓ `reading-L5-fill-msfx02ht-6` [reading] chosen=0 gold=0 · OK
  - note: The narrator explicitly states, "I am whatever I want to be-that's the dream,isn't it?" and "my power is only absolute here, where I am the true sovereign," hig
- ✓ `reading-L5-fill-msfx02ht-7` [reading] chosen=0 gold=0 · OK
  - note: The passage states, "'To get a hand in' is to begin a job, to begin to know something about it," which implies getting involved. It also says, "he may look at o
- ✓ `reading-L5-fill-msfy5oes-6` [reading] chosen=0 gold=0 · OK
  - note: The passage introduces and explains numerous expressions that use the word 'hand,' detailing their meanings and how they are used. This directly corresponds to 
- ✓ `reading-L5-fill-msfy5oes-7` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states, 'It means I can do what I want with it... I am whatever I want to be-that's the dream, isn't it?' and 'my power is only absolute 
- ✓ `reading-L5-fill-msfy5oes-8` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states: 'Your friend may want to work hand in glove with us. That is good because that means he wants to work as closely with us as a glo
- ✓ `vocabulary-L5-fill-msfx02ht-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The word 'ubiquitous' means present, appearing, or found everywhere, which perfectly matches the Korean meaning '어디에나 있는, 아주 흔한'.
- ✓ `vocabulary-L5-fill-msfx02ht-1` [vocabulary] chosen=2 gold=2 · OK
  - note: In the context of 'imposed economic sanctions on the rogue nation,' 'sanctions' refers to penalties or restrictions, which is best translated as '경제적 제재' (econo
- ✓ `vocabulary-L5-fill-msfx1sv9-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean words '덧없는, 단명하는' mean fleeting or short-lived, which perfectly matches the definition of 'ephemeral'.
- ✓ `vocabulary-L5-fill-msfx1sv9-1` [vocabulary] chosen=0 gold=0 · OK
  - note: Meticulous means showing great attention to detail; very careful and precise.
- ✓ `vocabulary-L5-fill-msfy5oes-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean phrase '어디에나 있는, 아주 흔한' translates to 'present everywhere, very common,' which is the definition of 'ubiquitous.'
- ✓ `vocabulary-L5-fill-msfy5oes-1` [vocabulary] chosen=0 gold=0 · OK
  - note: The word 'underscore' in this context is used figuratively to mean 'to emphasize' or 'to highlight'. A report doesn't physically draw a line; it brings attentio
- ✓ `vocabulary-L5-fill-msfy5oes-2` [vocabulary] chosen=0 gold=0 · OK
  - note: Meticulous means showing great attention to detail, which perfectly describes an artist's careful work.

### L6

- ✓ `grammar-L6-fill-msfx10co-2` [grammar] chosen=0 gold=0 · OK
  - note: When a negative adverbial phrase like 'Not until' begins a sentence, it requires inversion of the subject and auxiliary verb. The correct structure for past sim
- ✓ `grammar-L6-fill-msfx10co-3` [grammar] chosen=2 gold=2 · OK
  - note: The past participle 'made' correctly forms a reduced relative clause (originally 'which was made') that passively modifies 'The decision'. The decision was acte
- ✓ `grammar-L6-fill-msfx10co-4` [grammar] chosen=0 gold=0 · OK
  - note: The sentence 'Had I known about the party' is an inverted third conditional clause (equivalent to 'If I had known about the party'). The main clause for a third
- ✓ `grammar-L6-fill-msfy6myc-2` [grammar] chosen=1 gold=1 · OK
  - note: The phrase 'It is imperative that' requires the subjunctive mood in the 'that' clause, which means the base form of the verb (submit) should be used regardless 
- ✓ `grammar-L6-fill-msfy6myc-3` [grammar] chosen=1 gold=1 · OK
  - note: The past participle 'surprised' correctly describes the student's state of being affected by the announcement. Options 0, 2, and 3 use incorrect forms or struct
- ✓ `grammar-L6-fill-msfy6myc-4` [grammar] chosen=1 gold=1 · OK
  - note: When a negative adverb like 'Seldom' begins a sentence, it requires inversion of the subject and auxiliary verb. The correct structure is 'Negative Adverb + Aux
- ✓ `reading-L6-fill-msfx10co-5` [reading] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The passage introduces the RFID tracking nametags in Texas schools, explains the reasons for their implementation (financial benefits), details the concerns rai
- ✓ `reading-L6-fill-msfx10co-6` [reading] chosen=0 gold=0 · OK
  - note: The passage explicitly states the author was arrested after refusing the breathalyzer test and was charged with 'refusing to obey an officer.'
- ✓ `reading-L6-fill-msfx10co-7` [reading] chosen=0 gold=0 · OK
  - note: The passage states: 'the district expects a $2 million return on an initial investment of $261,000 in the technology at two pilot schools.' This directly answer
- ✓ `reading-L6-fill-msfy6myc-5` [reading] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The passage details the introduction of student tracking technology (RFID nametags) in Texas schools, explaining the reasons for its implementation (primarily f
- ✓ `reading-L6-fill-msfy6myc-6` [reading] chosen=0 gold=0 · OK
  - note: The author explicitly states the initial decision was 'the biggest mistake of my life' and concludes by wanting 'everyone reading this to know that it's not rig
- ✓ `reading-L6-fill-msfy6myc-7` [reading] chosen=0 gold=0 · OK
  - note: The passage states, 'Anson Jones is the first school in San Antonio's Northside Independent School District to roll out the new nametags, which are part of a pi
- ✓ `vocabulary-L6-fill-msfx10co-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean phrase '어디에나 있는, 아주 흔한' translates to 'existing everywhere, very common,' which perfectly matches the definition of 'ubiquitous.'
- ✓ `vocabulary-L6-fill-msfx10co-1` [vocabulary] chosen=1 gold=1 · OK
  - note: To mitigate means to make something less severe, serious, or painful. In the context of climate change, policies aim to lessen or reduce its negative effects.
- ✓ `vocabulary-L6-fill-msfx1zkz-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean phrase '어디에나 있는, 아주 흔한' translates to 'present everywhere, very common,' which is the definition of 'ubiquitous.'
- ✓ `vocabulary-L6-fill-msfx1zkz-1` [vocabulary] chosen=0 gold=0 · OK
  - note: The context 'ensuring every detail was perfect' indicates that 'meticulous' means careful and precise, which aligns with '세심한, 꼼꼼한'.
- ✓ `vocabulary-L6-fill-msfy6myc-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean phrase '어디에나 있는, 아주 흔한' translates to 'present, appearing, or found everywhere,' which is the definition of 'ubiquitous.'
- ✓ `vocabulary-L6-fill-msfy6myc-1` [vocabulary] chosen=2 gold=2 · OK
  - note: In the context of an economic downturn, governments implement policies to lessen or reduce its negative effects, which is the meaning of 'mitigate'.

## Mismatches (possible key/item issues)

- `grammar-2` [grammar] chosen=0 gold=2 flags=['KEY_MISMATCH']
- `reading-2-2` [reading] chosen=2 gold=0 flags=['KEY_MISMATCH', 'HIGH_CONF_WRONG']

## Interpretation

- High accuracy: bank keys mostly consistent with solvable stems.
- KEY_MISMATCH + HIGH_CONF_WRONG: review gold key or stem ambiguity.
- SOLVER_ERROR: API/transient; re-run smoke.

