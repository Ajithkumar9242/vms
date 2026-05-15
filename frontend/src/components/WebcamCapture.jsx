import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button, Space, Alert, Spin } from 'antd';
import { CameraOutlined, RedoOutlined, UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';

/**
 * WebcamCapture — Camera capture with fallback to file upload.
 * Works on desktop (webcam) and mobile (camera input).
 *
 * Props:
 *   onCapture(dataUrl, file) — called when image is ready
 *   value                    — current image URL (for preview in edit mode)
 *   accept                   — file types (default: "image/*")
 *   disabled                 — disable interaction
 */
const WebcamCapture = ({ onCapture, value, accept = 'image/*', disabled = false }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const fileRef     = useRef(null);
  const streamRef   = useRef(null);

  const [mode, setMode]           = useState('idle'); // idle | webcam | preview
  const [captured, setCaptured]   = useState(null);   // dataUrl
  const [preview, setPreview]     = useState(value || null);
  const [camError, setCamError]   = useState(null);
  const [starting, setStarting]   = useState(false);

  // Sync external value (edit mode)
  useEffect(() => {
    if (value && !captured) setPreview(value);
  }, [value]);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    setStarting(true);
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('webcam');
    } catch (err) {
      setCamError('Camera access denied or unavailable. Please use file upload instead.');
      setMode('idle');
    } finally {
      setStarting(false);
    }
  };

  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    setCaptured(dataUrl);
    setPreview(dataUrl);
    setMode('preview');

    // Convert dataUrl to File for upload
    dataUrlToFile(dataUrl, 'photo.jpg').then(file => {
      onCapture?.(dataUrl, file);
    });
  };

  const dataUrlToFile = async (dataUrl, filename) => {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const retake = () => {
    setCaptured(null);
    setPreview(value || null);
    setMode('idle');
    stopCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setCaptured(dataUrl);
      setPreview(dataUrl);
      setMode('preview');
      onCapture?.(dataUrl, file);
    };
    reader.readAsDataURL(file);
  };

  const hasCameraApi = !!navigator?.mediaDevices?.getUserMedia;

  return (
    <div style={{ width: '100%' }}>
      {/* Preview area */}
      {preview && (
        <div style={{ marginBottom: 10, textAlign: 'center', position: 'relative' }}>
          <img
            src={preview}
            alt="Captured"
            style={{
              width: '160px',
              height: '160px',
              objectFit: 'cover',
              borderRadius: 10,
              border: '2px solid var(--color-primary)',
              boxShadow: '0 4px 12px rgba(var(--color-primary-rgb),0.2)',
            }}
          />
          {mode === 'preview' && (
            <div style={{ marginTop: 4 }}>
              <CheckCircleOutlined style={{ color: '#16A34A', fontSize: 16 }} />
              <span style={{ fontSize: 12, color: '#16A34A', marginLeft: 4 }}>Photo captured</span>
            </div>
          )}
        </div>
      )}

      {/* Webcam live view */}
      {mode === 'webcam' && (
        <div style={{ marginBottom: 10, textAlign: 'center', position: 'relative' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              maxWidth: 320,
              borderRadius: 10,
              border: '2px solid var(--color-primary)',
              background: '#000',
            }}
          />
          <div style={{ marginTop: 8 }}>
            <Button
              type="primary"
              icon={<CameraOutlined />}
              onClick={capturePhoto}
              style={{ marginRight: 8 }}
            >
              Capture
            </Button>
            <Button onClick={retake}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Error alert */}
      {camError && (
        <Alert
          type="warning"
          message={camError}
          closable
          onClose={() => setCamError(null)}
          style={{ marginBottom: 8, fontSize: 12 }}
        />
      )}

      {/* Action buttons */}
      {mode !== 'webcam' && !disabled && (
        <Space wrap>
          {/* Webcam button — desktop */}
          {hasCameraApi && (
            <Button
              icon={starting ? <Spin size="small" /> : <CameraOutlined />}
              onClick={startCamera}
              disabled={starting}
              style={{ borderRadius: 8 }}
            >
              {starting ? 'Starting...' : preview ? 'Retake (Webcam)' : 'Use Webcam'}
            </Button>
          )}

          {/* Mobile camera / file input */}
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileRef.current?.click()}
            style={{ borderRadius: 8 }}
          >
            {preview ? 'Change Photo' : 'Upload / Camera'}
          </Button>

          {/* Retake button when captured */}
          {captured && (
            <Button icon={<RedoOutlined />} onClick={retake} style={{ borderRadius: 8 }}>
              Clear
            </Button>
          )}
        </Space>
      )}

      {/* Hidden file input — works for mobile camera too */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default WebcamCapture;
