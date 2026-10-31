import { createMetaResponse } from './meta.js'
import type { ScanComparison } from './scanComparison.js'

export async function explainProgress(
  comparison: ScanComparison | null,
  observations: string,
  language: 'bn' | 'en',
): Promise<{ text: string; generatedBy: 'muse-spark-1.3' | 'fallback' }> {
  const fallback = language === 'bn'
    ? comparison
      ? 'ছবির তুলনা থেকে নিশ্চিতভাবে গাছের সুস্থতা বা চিকিৎসার ফল বোঝা যায় না। একই গাছ ও একই পাতার অংশের আরও ছবি এবং নতুন লক্ষণ পর্যবেক্ষণ করুন; প্রয়োজনে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।'
      : 'তুলনা করার মতো আগের যাচাইকৃত ছবি নেই। পরবর্তী পর্যবেক্ষণের জন্য একই গাছ ও পাতার অংশের ছবি রাখুন।'
    : comparison
      ? 'The image comparison cannot confirm plant recovery or treatment success. Keep observing the same plant and leaf area, and seek local agricultural advice if symptoms continue or worsen.'
      : 'There is no earlier scan available for comparison. Keep this image and photograph the same plant and leaf area at the next check.'

  if (!comparison) {
    return { text: fallback, generatedBy: 'fallback' }
  }

  try {
    const languageName = language === 'bn' ? 'Bangla' : 'English'
    const result = await createMetaResponse(
      `You are a cautious agricultural observation assistant. Write 1-3 short sentences in ${languageName}. Explain only the supplied comparison assessment and farmer observations. Do not diagnose a disease, recommend chemicals, claim recovery or treatment success, or introduce facts. If comparison is inconclusive, say so plainly. Do not include numbers or alter measurements; numeric results are displayed separately from your text.`,
      JSON.stringify({
        assessment: comparison.assessment,
        comparable: comparison.comparable,
        reasons: comparison.reasons,
        farmerObservations: observations,
      }),
    )
    const text = result.answer.trim()
    if (!text || text.length > 2000) throw new Error('Invalid progress explanation.')
    return { text, generatedBy: 'muse-spark-1.3' }
  } catch {
    return { text: fallback, generatedBy: 'fallback' }
  }
}
