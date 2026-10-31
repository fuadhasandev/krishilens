import { z } from 'zod'
import type { AgentSession, StoredScan } from '../types.js'

export const inspectScanInputSchema = z
  .object({ scan_id: z.string().uuid() })
  .strict()

const observationSchema = z.object({
  id: z.string(),
  description: z.string(),
})

export const inspectScanOutputSchema = z
  .object({
    scanId: z.string().uuid(),
    crop: z.string(),
    target: z.string(),
    leafDetected: z.boolean(),
    leafPixelCount: z.number().int().nonnegative().nullable(),
    affectedArea: z.object({
      pixelCount: z.number().int().nonnegative().nullable(),
      percentage: z.number().min(0).max(100).nullable(),
      status: z.enum(['accepted', 'needs_review', 'unavailable']),
    }),
    segmentationQuality: z.enum(['accepted', 'needs_review', 'unavailable']),
    observations: z.array(observationSchema),
    imageObjects: z.array(
      z.object({
        label: z.string(),
        boundingBox: z.array(z.number()),
        confidence: z.number().optional(),
      }),
    ),
    warning: z.string().nullable(),
  })
  .strict()

export type ScanObservation = z.infer<typeof observationSchema>

export function observationsForScan(scan: StoredScan): ScanObservation[] {
  return observationsForScanLanguage(scan, 'en')
}

export function observationsForScanLanguage(
  scan: StoredScan,
  language: 'bn' | 'en',
): ScanObservation[] {
  const { analysis } = scan
  const observations: ScanObservation[] = []

  if (analysis.leaf.detected) {
    observations.push({
      id: 'sam-leaf-detected',
      description: language === 'bn'
        ? analysis.leaf.pixelCount === null
          ? 'SAM একটি পাতার সম্ভাব্য অংশ দেখিয়েছে, তবে পিক্সেল সংখ্যা যাচাই করা যায়নি।'
          : `SAM পাতার একটি সম্ভাব্য অংশে ${analysis.leaf.pixelCount}টি মাস্ক পিক্সেল দেখিয়েছে। এটি সেগমেন্টেশনের পর্যবেক্ষণ, রোগ নির্ণয় নয়।`
        : analysis.leaf.pixelCount === null
          ? 'SAM returned a leaf candidate; its pixel count was not validated.'
          : `SAM returned a leaf candidate with ${analysis.leaf.pixelCount} mask pixels. This is a segmentation observation, not a crop diagnosis.`,
    })
  } else {
    observations.push({
      id: 'sam-leaf-not-validated',
      description: language === 'bn'
        ? 'SAM ফসলের পাতার কোনো যাচাইকৃত মাস্ক দেয়নি।'
        : 'SAM did not return a validated crop-leaf mask.',
    })
  }

  if (analysis.affectedArea.status === 'accepted') {
    observations.push({
      id: 'sam-candidate-area-accepted',
      description: language === 'bn'
        ? `“${scan.target}” প্রার্থী মাস্কটি যাচাইকৃত পাতার মাস্কের ${analysis.affectedArea.pixelCount}টি পিক্সেলের সঙ্গে মিলে (${analysis.affectedArea.percentage}%)। এটি জ্যামিতিক সেগমেন্টেশন অনুমান, রোগের তীব্রতা নয়।`
        : `The candidate "${scan.target}" mask intersects the validated leaf mask in ${analysis.affectedArea.pixelCount} pixels (${analysis.affectedArea.percentage}%). This is a geometric segmentation estimate, not disease severity.`,
    })
  } else if (analysis.affectedArea.status === 'needs_review') {
    observations.push({
      id: 'sam-candidate-area-needs-review',
      description: language === 'bn'
        ? 'SAM-এর প্রার্থী অঞ্চলের মাস্ক পাতার মাস্কের সঙ্গে নির্ভরযোগ্যভাবে মেলেনি; ক্ষতিগ্রস্ত এলাকার কোনো পরিমাপ পাওয়া যায়নি।'
        : 'SAM candidate-region masks could not be consistently reconciled with the leaf mask; no affected-area estimate is available.',
    })
  } else {
    observations.push({
      id: 'sam-candidate-area-unavailable',
      description: language === 'bn'
        ? 'এই স্ক্যান থেকে ক্ষতিগ্রস্ত এলাকার কোনো যাচাইকৃত পরিমাপ পাওয়া যায়নি।'
        : 'No validated candidate affected-area estimate is available from this scan.',
    })
  }

  return observations
}

export function inspectScan(
  input: z.infer<typeof inspectScanInputSchema>,
  session: AgentSession,
  scan: StoredScan | null,
): z.infer<typeof inspectScanOutputSchema> {
  if (!scan || input.scan_id !== session.scanId || scan.id !== session.scanId) {
    throw new Error('The requested scan is unavailable to this investigation.')
  }

  return inspectScanOutputSchema.parse({
    scanId: scan.id,
    crop: scan.crop,
    target: scan.target,
    leafDetected: scan.analysis.leaf.detected,
    leafPixelCount: scan.analysis.leaf.pixelCount,
    affectedArea: scan.analysis.affectedArea,
    segmentationQuality: scan.analysis.affectedArea.status,
    observations: observationsForScanLanguage(scan, session.language),
    imageObjects: scan.analysis.objects.map((object) => ({
      label: object.label,
      boundingBox: object.boundingBox,
      ...(object.confidence === undefined ? {} : { confidence: object.confidence }),
    })),
    warning: scan.analysis.warning ?? null,
  })
}
