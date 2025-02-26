import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const ANALYSIS_PROMPT = `Extract ALL exercises from this content into a single structured exercise and return as JSON. The content is already in mmd format a mathpix format that is related to latex, use the same formatting in your answer.

CRITICAL VALIDATION STEPS:
1. First, count the total number of exercises and sub-parts in the document
2. Create a checklist of all exercises and their components
3. Ensure EVERY exercise and sub-part is included in your response
4. Double-check that no exercises are missing
5. Verify that exercise numbering is consistent
6. Confirm all related parts are properly linked

Format your response EXACTLY as follows:

{
  "title": "Main topic or document title",
  "description": "Brief overview of the content",
  "difficulty": "beginner|intermediate|advanced",
  "subject": "Mathematics|Physics|Chemistry",
  "totalExercises": "Total number of exercises found in document",
  "exerciseChecklist": [
    "List of all exercise numbers/identifiers found"
  ],
  "context": {
    "id": "ctx-1",
    "content": "Complete context text that applies to all related sub-parts"
  },
  "subExercises": [
    {
      "id": "1",
      "question": "Complete question text EXACTLY as in the source,
      "image": Copy the url given to you if there is an image or graph given in the document, they always come as links. Try to place the image where needed. 
      "correctAnswer": "Expected answer",
      "order": 1,
      "isSubPart": false,
      "contextId": null,
      "relatedParts": null,
      "originalNumber": "Original exercise number/identifier from source"
    }
  ],
  "validationResults": {
    "totalExercisesFound": "Number of exercises extracted",
    "allExercisesExtracted": true,
    "missingExercises": [],
    "validationChecks": [
      "List of validation steps performed"
    ]
  }
}

CRITICAL RULES:
1. Keep ALL content EXACTLY as in the source:
   - Preserve ALL links in the text as given, we need these links to fetch pictures related to this excercise
   -If an image or graphic is given at e.g. excercise 4, copy the image link to all excercises related to excercise 4. 
   - Keep ALL math expressions unchanged use also the mmd format. Also make sure you keep spaces within functions excactly as given. Don´t remove spaces or add them.
   - Do not modify ANY paths or filenames
2. For multi-part questions:
   - Set isSubPart: true
   - Create a shared context
   - Link related parts
3. Never modify:
   - Image links 
   - Math expressions
   - Original text
4. Validation requirements:
   - Count total exercises at the start
   - Create checklist of all exercise numbers
   - Cross-reference extracted exercises against checklist
   - Verify no exercises are missing
   - Include validation results in response
5. Exercise numbering:
   - Preserve original exercise numbers/identifiers
   - Maintain hierarchical structure
   - Keep sub-part labeling (a, b, c, etc.)
6. Completeness check:
   - Review document multiple times
   - Verify all exercises are captured
   - Double-check for missed content
   - Ensure no partial extractions`;

export async function analyzeWithOpenAI(content: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are a precise mathematical exercise extractor. Your primary goal is to ensure ALL exercises are extracted completely and accurately. Double-check your work multiple times.

Key responsibilities:
1. Extract every single exercise and sub-part
2. Maintain exact original formatting and language
3. Verify completeness through multiple validation steps
4. Report any potential missing content
5. Preserve all mathematical expressions exactly as written`
        },
        {
          role: "user",
          content: `${ANALYSIS_PROMPT}\n\nContent to analyze and return as JSON:\n${content}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return response.choices[0]?.message?.content 
      ? JSON.parse(response.choices[0].message.content)
      : null;
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw error;
  }
}