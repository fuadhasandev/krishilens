import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, Mic, RotateCcw, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '../i18n'
import { transcribeVoice, type VoiceAuthorization } from '../services/voice'
import {
  convertRecordingToWav,
  MAX_VOICE_DURATION_SECONDS,
  supportedRecordingMimeType,
} from '../utils/voiceAudio'
import { Button } from './ui'

interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void
  authorization?: VoiceAuthorization
  disabled?: boolean
}

function recordingError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'MICROPHONE_PERMISSION_DENIED'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'MICROPHONE_UNAVAILABLE'
    }
    if (
      error.message === 'UNSUPPORTED_AUDIO_FORMAT' ||
      error.message === 'EMPTY_AUDIO' ||
      error.message === 'AUDIO_TOO_LONG'
    ) {
      return error.message
    }
  }
  return 'RECORDING_FAILED'
}

export function VoiceRecorder({
  onTranscript,
  authorization,
  disabled = false,
}: VoiceRecorderProps) {
  const { t, i18n } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [retryAudio, setRetryAudio] = useState<Blob | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)
  const canceledRef = useRef(false)
  const mountedRef = useRef(true)

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const sendForTranscription = useCallback(async (audio: Blob) => {
    if (!mountedRef.current) return
    setTranscribing(true)
    setError('')
    try {
      const result = await transcribeVoice(audio, currentLanguage(), authorization)
      if (!mountedRef.current) return
      setTranscript(result)
      onTranscript(result)
    } catch (transcriptionError) {
      if (mountedRef.current) {
        setError(
          transcriptionError instanceof Error
            ? transcriptionError.message
            : 'TRANSCRIPTION_FAILED',
        )
      }
    } finally {
      if (mountedRef.current) setTranscribing(false)
    }
  }, [authorization, onTranscript])

  const processRecording = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (canceledRef.current || !mountedRef.current) return
    if (chunks.length === 0) {
      setError('EMPTY_AUDIO')
      return
    }

    try {
      const recordingBlob = new Blob(chunks, { type: mimeType })
      const wav = await convertRecordingToWav(recordingBlob)
      if (!mountedRef.current || canceledRef.current) return
      setRetryAudio(wav)
      await sendForTranscription(wav)
    } catch (conversionError) {
      if (mountedRef.current) setError(recordingError(conversionError))
    }
  }, [sendForTranscription])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      recorder.stop()
    } else {
      stopTracks()
      setRecording(false)
    }
  }, [stopTracks])

  function cancelRecording() {
    canceledRef.current = true
    chunksRef.current = []
    setError('')
    setRecording(false)
    setDuration(0)
    stopRecording()
    stopTracks()
  }

  async function startRecording() {
    setError('')
    setTranscript('')
    setRetryAudio(null)
    setDuration(0)
    canceledRef.current = false

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('MICROPHONE_UNSUPPORTED')
      return
    }

    const mimeType = supportedRecordingMimeType(MediaRecorder)
    if (!mimeType) {
      setError('MICROPHONE_UNSUPPORTED')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []
      recordingStartedAtRef.current = Date.now()
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const chunks = chunksRef.current
        chunksRef.current = []
        setRecording(false)
        stopTracks()
        void processRecording(chunks, recorder.mimeType || mimeType)
      }
      recorder.onerror = () => {
        canceledRef.current = true
        setError('RECORDING_FAILED')
        setRecording(false)
        stopTracks()
      }
      recorder.start()
      setRecording(true)
    } catch (permissionError) {
      stopTracks()
      setError(recordingError(permissionError))
    }
  }

  useEffect(() => {
    if (!recording) return
    const interval = window.setInterval(() => {
      const seconds = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / 1000,
      )
      setDuration(Math.min(seconds, MAX_VOICE_DURATION_SECONDS))
      if (seconds >= MAX_VOICE_DURATION_SECONDS) stopRecording()
    }, 250)
    return () => window.clearInterval(interval)
  }, [recording, stopRecording])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      canceledRef.current = true
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stopTracks()
    }
  }, [stopTracks])

  const localizedDuration = new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })
  const formattedDuration = `${localizedDuration.format(Math.floor(duration / 60))}:${localizedDuration.format(duration % 60)}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!recording && !transcribing && (
          <Button
            aria-label={t('voice.start')}
            className="min-h-11 px-4"
            disabled={disabled}
            onClick={() => void startRecording()}
            type="button"
            variant="secondary"
          >
            <Mic aria-hidden="true" size={18} />
            {t('voice.start')}
          </Button>
        )}

        {recording && (
          <>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#fff0ec] px-3 text-sm font-medium text-[#854735]" role="status">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-[#b84a3a]" />
              {t('voice.recording')} · {formattedDuration}
            </span>
            <Button
              aria-label={t('voice.stop')}
              className="min-h-11 px-4"
              onClick={stopRecording}
              type="button"
            >
              <Square aria-hidden="true" size={16} />
              {t('voice.stop')}
            </Button>
            <Button
              aria-label={t('voice.cancel')}
              className="min-h-11 px-4"
              onClick={cancelRecording}
              type="button"
              variant="secondary"
            >
              <X aria-hidden="true" size={17} />
              {t('voice.cancel')}
            </Button>
          </>
        )}

        {transcribing && (
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#326548]" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
            {t('voice.transcribing')}
          </span>
        )}

        {!recording && !transcribing && retryAudio && (
          <Button
            className="min-h-11 px-4"
            disabled={disabled}
            onClick={() => void sendForTranscription(retryAudio)}
            type="button"
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" size={16} />
            {t('voice.retry')}
          </Button>
        )}
      </div>

      {transcript && (
        <p aria-live="polite" className="text-sm leading-6 text-[#46564a]">
          <span className="font-semibold">{t('voice.recognized')} </span>
          {transcript}
          <span className="block text-xs text-[#7b887e]">{t('voice.review')}</span>
        </p>
      )}
      {error && (
        <p aria-live="polite" className="text-sm leading-5 text-[#854735]" role="alert">
          {t(`errors.${error}`, { defaultValue: t('errors.TRANSCRIPTION_FAILED') })}
        </p>
      )}
    </div>
  )
}
