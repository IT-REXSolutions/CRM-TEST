import OpenAI from 'openai'

// Initialize OpenAI client with Emergent Universal Key
const openai = new OpenAI({
  apiKey: process.env.EMERGENT_LLM_KEY,
  baseURL: 'https://api.emergent.sh/v1/openai',
})

/**
 * Generate text completion using GPT-4o
 */
export async function generateCompletion(prompt, options = {}) {
  const {
    systemPrompt = 'Du bist ein hilfreicher Assistent für IT-Service-Management.',
    temperature = 0.7,
    maxTokens = 1000,
  } = options

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
    })

    return {
      success: true,
      content: response.choices[0]?.message?.content || '',
      tokens: response.usage?.total_tokens || 0,
    }
  } catch (error) {
    console.error('OpenAI Error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Summarize ticket content using AI
 */
export async function summarizeTicket(ticketContent, comments = []) {
  const systemPrompt = `Du bist ein IT-Support-Analyst. Erstelle eine strukturierte Zusammenfassung im folgenden Format:

**Problem:**
[Kurze Beschreibung des Problems]

**Maßnahmen:**
[Durchgeführte oder geplante Schritte]

**Status:**
[Aktueller Status]

**Nächste Schritte:**
[Empfohlene nächste Aktionen]`

  const prompt = `Ticket-Inhalt:
${ticketContent}

${comments.length > 0 ? `Kommentare:\n${comments.map(c => `- ${c}`).join('\n')}` : ''}`

  return generateCompletion(prompt, { systemPrompt, maxTokens: 500 })
}

/**
 * Parse dictated text into structured format
 */
export async function parseDictation(text, type = 'ticket') {
  const prompts = {
    ticket: `Strukturiere den folgenden diktierten Text als Ticket:
- Betreff (kurz und prägnant)
- Beschreibung (detailliert)
- Priorität (niedrig/mittel/hoch/kritisch)
- Kategorie (falls erkennbar)

Diktierter Text: "${text}"

Antworte im JSON-Format: {"subject": "", "description": "", "priority": "", "category": ""}`,
    
    task: `Strukturiere den folgenden diktierten Text als Aufgabe:
- Titel (kurz und prägnant)
- Beschreibung (detailliert)
- Fälligkeitsdatum (falls erwähnt)
- Priorität (niedrig/mittel/hoch)

Diktierter Text: "${text}"

Antworte im JSON-Format: {"title": "", "description": "", "dueDate": "", "priority": ""}`,
    
    time: `Extrahiere aus dem folgenden diktierten Text die Zeiterfassung:
- Dauer (in Minuten)
- Beschreibung der Tätigkeit
- Abrechenbar (ja/nein)

Diktierter Text: "${text}"

Antworte im JSON-Format: {"duration": 0, "description": "", "billable": true}`,
    
    comment: `Strukturiere den folgenden diktierten Text als Kommentar:
- Inhalt (vollständiger Text, ggf. leicht geglättet)
- Typ (intern/extern)

Diktierter Text: "${text}"

Antworte im JSON-Format: {"content": "", "type": "extern"}`
  }

  const systemPrompt = 'Du bist ein Assistent der diktierten Text strukturiert. Antworte NUR mit validem JSON, ohne zusätzlichen Text.'
  
  try {
    const result = await generateCompletion(prompts[type] || prompts.ticket, { 
      systemPrompt, 
      temperature: 0.3,
      maxTokens: 300 
    })
    
    if (result.success) {
      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return {
          success: true,
          data: JSON.parse(jsonMatch[0])
        }
      }
    }
    return { success: false, error: 'Could not parse response' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Transcribe audio file using Whisper
 * Note: Requires audio file in supported format
 */
export async function transcribeAudio(audioFile) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'de', // German
    })

    return {
      success: true,
      text: transcription.text,
    }
  } catch (error) {
    console.error('Whisper Error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

export default openai
