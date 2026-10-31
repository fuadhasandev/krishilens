export type ComparisonAssessment =
  | 'possible_improvement'
  | 'possible_worsening'
  | 'inconclusive'

export interface ComparableScan {
  scanId: string
  affectedPercent: number | null
  measurementQuality: 'accepted' | 'needs_review' | 'unavailable'
  width: number
  height: number
  imageQuality: {
    similarLighting: boolean | null
    similarAngle: boolean | null
    samePlantRegion: boolean | null
  }
}

export interface ScanComparison {
  previousScanId: string
  currentScanId: string
  previousAffectedPercent: number | null
  currentAffectedPercent: number | null
  percentagePointChange: number | null
  comparable: boolean
  assessment: ComparisonAssessment
  reasons: string[]
}

function validPercentage(scan: ComparableScan): number | null {
  return scan.measurementQuality === 'accepted' &&
    typeof scan.affectedPercent === 'number' &&
    Number.isFinite(scan.affectedPercent) &&
    scan.affectedPercent >= 0 &&
    scan.affectedPercent <= 100
    ? scan.affectedPercent
    : null
}

export function compareScans(
  previous: ComparableScan,
  current: ComparableScan,
): ScanComparison {
  const previousAffectedPercent = validPercentage(previous)
  const currentAffectedPercent = validPercentage(current)
  const reasons: string[] = []

  if (previousAffectedPercent === null || currentAffectedPercent === null) {
    reasons.push('validated_measurement_unavailable')
  }
  const dimensionsComparable =
    previous.width > 0 &&
    previous.height > 0 &&
    current.width > 0 &&
    current.height > 0 &&
    Math.abs(previous.width / previous.height - current.width / current.height) <= 0.1
  if (!dimensionsComparable) reasons.push('image_dimensions_not_comparable')

  for (const key of ['similarLighting', 'similarAngle', 'samePlantRegion'] as const) {
    if (current.imageQuality[key] !== true) {
      reasons.push(`${key}_not_confirmed`)
    }
  }

  const comparable =
    previousAffectedPercent !== null &&
    currentAffectedPercent !== null &&
    dimensionsComparable &&
    reasons.length === 0
  const percentagePointChange =
    previousAffectedPercent !== null && currentAffectedPercent !== null
      ? Math.round((currentAffectedPercent - previousAffectedPercent) * 10) / 10
      : null

  return {
    previousScanId: previous.scanId,
    currentScanId: current.scanId,
    previousAffectedPercent,
    currentAffectedPercent,
    percentagePointChange,
    comparable,
    assessment: comparable && percentagePointChange !== null
      ? percentagePointChange < 0
        ? 'possible_improvement'
        : percentagePointChange > 0
          ? 'possible_worsening'
          : 'inconclusive'
      : 'inconclusive',
    reasons: comparable
      ? percentagePointChange === 0
        ? ['no_measurable_percentage_point_change']
        : ['visible_measurement_change_only_not_proof_of_recovery']
      : reasons,
  }
}
