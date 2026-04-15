'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

const LIBRARY_NAME = 'School Library';
const LIBRARY_ADDRESS = 'Salazar Colleges of Science and Institute Of Technology';
const LIBRARY_QUERY = LIBRARY_ADDRESS;
const MAP_EMBED_URL = `https://www.google.com/maps?output=embed&q=${encodeURIComponent(LIBRARY_QUERY)}`;
const MAP_PLACE_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LIBRARY_QUERY)}`;
const MAP_DIRECTIONS_BASE_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  LIBRARY_QUERY
)}`;

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function LibraryLocationSection() {
  const [tracking, setTracking] = useState(false);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const goldPrimaryButtonClass =
    'inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#1a1b1f] transition-all duration-300 sm:w-auto hover:-translate-y-0.5';
  const goldSecondaryButtonClass =
    'inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 sm:w-auto hover:-translate-y-0.5';

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  };

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }

    setLocationError(null);
    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location access was denied. Enable location permission to use live tracking.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Unable to read your location right now. Please try again.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Please retry.');
        } else {
          setLocationError('Unable to start live location tracking.');
        }
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );
  };

  useEffect(() => () => stopTracking(), []);

  const directionsUrl = useMemo(() => {
    if (!liveLocation) {
      return MAP_DIRECTIONS_BASE_URL;
    }

    return `${MAP_DIRECTIONS_BASE_URL}&origin=${liveLocation.latitude},${liveLocation.longitude}&travelmode=walking`;
  }, [liveLocation]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-fade-up delay-250">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">School Library Location</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Real-time map access</h3>
          <p className="mt-3 max-w-xl text-sm text-white/70 leading-relaxed">
            View the exact location of {LIBRARY_NAME} and start live tracking from your current position to
            open directions instantly.
          </p>
          <p className="mt-2 text-sm text-white/65">{LIBRARY_ADDRESS}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
            <span
              className={`rounded-full border px-3 py-1.5 ${
                tracking
                  ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100'
                  : 'border-white/20 bg-white/10 text-white/70'
              }`}
            >
              {tracking ? 'Live Tracking On' : 'Live Tracking Off'}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white/70">
              {liveLocation ? `Updated ${formatTimestamp(liveLocation.timestamp)}` : 'Awaiting location'}
            </span>
            {liveLocation && (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white/70">
                Accuracy +/- {Math.round(liveLocation.accuracy)}m
              </span>
            )}
          </div>

          {locationError && <p className="mt-4 text-sm text-amber-200">{locationError}</p>}

          {liveLocation && (
            <p className="mt-3 text-sm text-white/70">
              Current location: {liveLocation.latitude.toFixed(5)}, {liveLocation.longitude.toFixed(5)}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={tracking ? stopTracking : startTracking}
              className={`${tracking ? goldSecondaryButtonClass : goldPrimaryButtonClass} ${
                tracking
                  ? 'border border-amber-200/18 bg-[linear-gradient(135deg,rgba(146,64,14,0.88)_0%,rgba(180,83,9,0.84)_45%,rgba(120,53,15,0.9)_100%)] text-amber-50 shadow-[0_16px_34px_rgba(120,53,15,0.24)] hover:border-amber-200/28 hover:text-white'
                  : 'shadow-[0_16px_34px_rgba(212,175,55,0.28),0_4px_10px_rgba(0,0,0,0.24)]'
              }`}
              style={
                tracking
                  ? undefined
                  : {
                      background:
                        'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)',
                    }
              }
            >
              {tracking ? 'Stop Live Tracking' : 'Start Live Tracking'}
            </button>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className={`${goldSecondaryButtonClass} border border-amber-200/16 bg-[linear-gradient(135deg,rgba(245,158,11,0.18)_0%,rgba(212,175,55,0.12)_46%,rgba(15,23,42,0.14)_100%)] text-amber-50 shadow-[0_14px_28px_rgba(212,175,55,0.10)] hover:border-amber-200/28 hover:bg-[linear-gradient(135deg,rgba(245,158,11,0.24)_0%,rgba(212,175,55,0.16)_46%,rgba(15,23,42,0.16)_100%)]`}
            >
              Open Live Directions
            </a>
            <a
              href={MAP_PLACE_URL}
              target="_blank"
              rel="noreferrer"
              className={`${goldSecondaryButtonClass} border border-amber-200/12 bg-[rgba(212,175,55,0.08)] text-amber-100/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-amber-200/24 hover:bg-[rgba(212,175,55,0.14)] hover:text-white`}
            >
              Open Full Map
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
          <iframe
            title="School Library Map Location"
            src={MAP_EMBED_URL}
            className="h-[280px] w-full sm:h-[320px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
