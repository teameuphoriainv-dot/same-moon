"use client";

import manifest from "@/lib/photo-manifest.json";

const CAPTIONS = ["Plate I", "Plate II", "Plate III", "Plate IV", "Plate V", "Plate VI"];

export function Plates() {
  const photos = (manifest as { photos: string[] }).photos;

  // With nothing mounted this section was only instructions for whoever
  // runs the build. The storybook is where photos go now.
  if (photos.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Plates</h2>
        <span className="label">
          {photos.length > 0 ? `${photos.length} mounted` : "public / photos"}
        </span>
      </div>

      <div className="plates">
        {photos.length === 0
          ? Array.from({ length: 3 }, (_, i) => (
              <div className="plate" key={i}>
                <div className="plate-empty">
                  Drop a photo into
                  <br />
                  public/photos
                  <br />
                  then run npm run photos
                </div>
              </div>
            ))
          : photos.map((file, i) => (
              <div className="plate" key={file}>
                <figure>
                  {/* Local files only, so a plain img beats the remote-image loader. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/photos/${encodeURIComponent(file)}`} alt="" loading="lazy" />
                  <figcaption>{CAPTIONS[i] ?? `Plate ${i + 1}`}</figcaption>
                </figure>
              </div>
            ))}
      </div>
    </section>
  );
}
