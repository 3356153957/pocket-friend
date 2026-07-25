import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createPlaceholderResidentFromPhoto,
  needsPixelGeneration,
  normalizeManagedPhotoName,
  reconcileResidentsWithPhotos,
  syncPhotoResidents,
} from "../src/app/photoResidentSync.ts";

const resident = {
  id: "old-photo-name-2026-07-25T12:00:00.000Z.jpg",
  name: "旧名字",
  magnetType: "好奇选手",
  tags: ["小岛"],
  pixelPortraitUrl: "data:image/png;base64,AA==",
  createdAt: "2026-07-25T12:00:00.000Z",
  updatedAt: "2026-07-25T12:01:00.000Z",
  source: "hardware" as const,
  spriteSource: "seedream" as const,
};

describe("4311 photo resident synchronization", () => {
  test("removes numeric filename suffixes from managed resident names", () => {
    assert.equal(normalizeManagedPhotoName("小明_003.jpg"), "小明");
    assert.equal(normalizeManagedPhotoName("小明-12"), "小明");
    assert.equal(normalizeManagedPhotoName("小明123"), "小明");
  });

  test("uses captured time as stable identity when a photo is renamed", () => {
    const synced = reconcileResidentsWithPhotos([resident], [{
      id: "new-photo-name-2026-07-25T12:00:00.000Z.jpg",
      name: "新名字_2",
      capturedAt: "2026-07-25T12:00:00.000Z",
      url: "/api/photos/board-a/history/new-photo",
    }]);

    assert.equal(synced.length, 1);
    assert.equal(synced[0]?.name, "新名字");
  });

  test("removes residents whose photos were deleted in 4311", () => {
    assert.deepEqual(reconcileResidentsWithPhotos([resident], []), []);
  });

  test("builds visible island residents directly from 4311 photos", () => {
    const photos = [{
      id: "photo-a",
      name: "小岛居民_01",
      capturedAt: "2026-07-25T12:00:00.000Z",
      url: "/api/photos/board-a/history/photo-a",
    }];
    const synced = syncPhotoResidents([], photos, (photo, index) => (
      createPlaceholderResidentFromPhoto(photo, index, "http://localhost/photo-a.jpg", ["venture-center"])
    ));

    assert.equal(synced[0]?.id, "2026-07-25T12:00:00.000Z");
    assert.equal(synced[0]?.name, "小岛居民");
    assert.equal(synced[0]?.pixelPortraitUrl, "http://localhost/photo-a.jpg");
    assert.equal(needsPixelGeneration(synced[0]!), true);
  });

  test("keeps generated cached sprites while syncing 4311 rename and delete", () => {
    const cached = {
      ...resident,
      id: "2026-07-25T12:00:00.000Z",
      pixelPortraitUrl: "data:image/png;base64,PIXEL",
      portraitUrl: "http://localhost/photo.jpg",
      activeSceneId: "venture-center",
    };
    const synced = syncPhotoResidents([cached], [{
      id: "renamed-photo",
      name: "新名字_9",
      capturedAt: "2026-07-25T12:00:00.000Z",
      url: "/api/photos/board-a/history/renamed-photo",
    }], () => {
      throw new Error("cached resident should be reused");
    });

    assert.equal(synced[0]?.name, "新名字");
    assert.equal(synced[0]?.pixelPortraitUrl, "data:image/png;base64,PIXEL");
    assert.equal(needsPixelGeneration(synced[0]!), false);
    assert.deepEqual(syncPhotoResidents([cached], [], () => cached), []);
  });
});
