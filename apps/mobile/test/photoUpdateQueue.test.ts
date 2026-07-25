import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PhotoProcessingQueue,
  findPhotosAfter,
  shouldStartPhotoArrival,
} from "../src/app/photoUpdateQueue.ts";

interface Candidate {
  id: string;
  name: string;
}

describe("hardware photo processing queue", () => {
  test("keeps every uploaded photo in FIFO order while another photo is processing", () => {
    const queue = new PhotoProcessingQueue<Candidate>();
    const photoA = { id: "a", name: "照片 A" };
    const photoB = { id: "b", name: "照片 B" };
    const photoC = { id: "c", name: "照片 C" };

    queue.start(photoA);
    assert.equal(queue.observe(photoB), true);
    assert.equal(queue.observe(photoC), true);

    assert.deepEqual(queue.takePending(), photoB);
    assert.deepEqual(queue.takePending(), photoC);
    assert.equal(queue.takePending(), null);
  });

  test("does not queue the active photo or the same pending photo twice", () => {
    const queue = new PhotoProcessingQueue<Candidate>();
    const photoA = { id: "a", name: "照片 A" };
    const photoB = { id: "b", name: "照片 B" };

    queue.start(photoA);
    assert.equal(queue.observe(photoA), false);
    assert.equal(queue.observe(photoB), true);
    assert.equal(queue.observe(photoB), false);
    assert.deepEqual(queue.takePending(), photoB);
  });

  test("reopens arrival only for a photo that has not been handled", () => {
    assert.equal(shouldStartPhotoArrival("new-photo", "old-photo"), true);
    assert.equal(shouldStartPhotoArrival("same-photo", "same-photo"), false);
    assert.equal(shouldStartPhotoArrival("", "old-photo"), false);
  });

  test("returns every photo uploaded after the last handled photo in upload order", () => {
    const newestFirst = [
      { id: "c", name: "照片 C" },
      { id: "b", name: "照片 B" },
      { id: "a", name: "照片 A" },
    ];

    assert.deepEqual(findPhotosAfter(newestFirst, "a"), [
      { id: "b", name: "照片 B" },
      { id: "c", name: "照片 C" },
    ]);
  });
});
