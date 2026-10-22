import { PDFDocument, PDFName, PDFPageTree } from '@pdfme/pdf-lib';
import { move, organize } from '../src/index';
import { createTestPDF, getPDFPageCount } from './test-helpers';

const identityPdf = async (count: number) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([100 + i, 200]);
  return doc.save();
};

const order = async (pdf: Uint8Array) =>
  (await PDFDocument.load(pdf)).getPages().map((page) => page.getWidth() - 100);

describe('move', () => {
  test('moves page from one position to another', async () => {
    const pdf = await identityPdf(3);
    const result = await move(pdf, { from: 0, to: 2 });
    expect(await getPDFPageCount(result)).toBe(3);
    expect(await order(result)).toEqual([1, 2, 0]);
  });

  test.each([
    [0, 2, [1, 2, 0, 3, 4]],
    [0, 1, [1, 0, 2, 3, 4]],
    [1, 4, [0, 2, 3, 4, 1]],
    [4, 1, [0, 4, 1, 2, 3]],
    [3, 0, [3, 0, 1, 2, 4]],
    [2, 2, [0, 1, 2, 3, 4]],
  ] as const)('moves %i to final index %i', async (from, to, expected) => {
    expect(await order(await move(await identityPdf(5), { from, to }))).toEqual(expected);
  });

  test('rejects destination equal to page count', async () => {
    await expect(move(await identityPdf(5), { from: 0, to: 5 })).rejects.toThrow(
      '[@pdfme/manipulator] Invalid page number: from=0, to=5, total pages=5',
    );
  });

  test('throws error for invalid page numbers', async () => {
    const pdf = await createTestPDF(3);
    await expect(move(pdf, { from: 3, to: 0 })).rejects.toThrow(
      '[@pdfme/manipulator] Invalid page number: from=3, to=0, total pages=3'
    );
  });
});

const state = async (pdf: Uint8Array) =>
  (await PDFDocument.load(pdf)).getPages().map((page) => ({
    w: page.getWidth(),
    rot: page.getRotation().angle,
    crop: page.getCropBox(),
    procset: !!page.node.Resources()?.get(PDFName.of('ProcSet')),
  }));

const pageState = (w: number, rot = 0, width = w, height = 200, procset = false) => ({
  w, rot, crop: { x: 0, y: 0, width, height }, procset,
});

const nestedPdf = async () => {
  const doc = await PDFDocument.create();
  const pages = Array.from({ length: 4 }, (_, i) => doc.addPage([100 + i, 200]));
  const root = doc.catalog.Pages();
  const parent = PDFPageTree.withContext(doc.context, doc.context.getObjectRef(root));
  parent.set(PDFName.of('Kids'), doc.context.obj(pages.slice(0, 3).map((page) => page.ref)));
  parent.set(PDFName.of('Count'), doc.context.obj(3));
  parent.set(PDFName.MediaBox, doc.context.obj([0, 0, 100, 200]));
  parent.set(PDFName.of('Rotate'), doc.context.obj(90));
  parent.set(PDFName.Resources, doc.context.obj({ ProcSet: ['PDF', 'ImageB'] }));
  const parentRef = doc.context.register(parent);
  root.set(PDFName.of('Kids'), doc.context.obj([parentRef, pages[3].ref]));
  root.set(PDFName.MediaBox, doc.context.obj([0, 0, 999, 888]));
  root.set(PDFName.of('Rotate'), doc.context.obj(0));
  pages.slice(0, 3).forEach((page) => page.node.setParent(parentRef));
  pages[0].node.delete(PDFName.MediaBox);
  pages[0].node.delete(PDFName.Resources);
  return doc.save();
};

const defaultsPdf = async () => {
  const doc = await PDFDocument.create();
  const pages = Array.from({ length: 4 }, (_, i) => doc.addPage([100 + i, 200]));
  const root = doc.catalog.Pages();
  const parent = PDFPageTree.withContext(doc.context, doc.context.getObjectRef(root));
  parent.set(PDFName.of('Kids'), doc.context.obj(pages.slice(2).map((page) => page.ref)));
  parent.set(PDFName.of('Count'), doc.context.obj(2));
  parent.set(PDFName.of('Rotate'), doc.context.obj(90));
  parent.set(PDFName.CropBox, doc.context.obj([0, 0, 40, 50]));
  const parentRef = doc.context.register(parent);
  root.set(PDFName.of('Kids'), doc.context.obj([pages[0].ref, pages[1].ref, parentRef]));
  pages.slice(2).forEach((page) => page.node.setParent(parentRef));
  return doc.save();
};

const nestedForward = [
  pageState(101, 90), pageState(102, 90), pageState(100, 90, 100, 200, true), pageState(103),
];
const defaultsForward = [
  pageState(101), pageState(102, 90, 40, 50), pageState(100), pageState(103, 90, 40, 50),
];
const defaultsBackward = [
  pageState(103, 90, 40, 50), pageState(100), pageState(101), pageState(102, 90, 40, 50),
];

describe('move preserves effective page attributes', () => {
  test('n0: nested fixture inherits MediaBox, rotation and resources', async () => {
    expect((await state(await nestedPdf()))[0]).toEqual(pageState(100, 90, 100, 200, true));
  });

  test('n1: forward move preserves inherited attributes', async () => {
    expect(await state(await move(await nestedPdf(), { from: 0, to: 2 }))).toEqual(nestedForward);
  });

  test('n2: organize forward move preserves inherited attributes', async () => {
    const result = await organize(await nestedPdf(), [{ type: 'move', data: { from: 0, to: 2 } }]);
    expect(await state(result)).toEqual(nestedForward);
  });

  test('n3: backward move preserves local attributes and defaults', async () => {
    expect((await state(await move(await nestedPdf(), { from: 3, to: 0 })))[0]).toEqual(pageState(103));
  });

  test('d0: defaults fixture distinguishes absent and inherited attributes', async () => {
    expect(await state(await defaultsPdf())).toEqual([
      pageState(100), pageState(101), pageState(102, 90, 40, 50), pageState(103, 90, 40, 50),
    ]);
  });

  test('d1: forward move preserves absent rotation and CropBox defaults', async () => {
    expect(await state(await move(await defaultsPdf(), { from: 0, to: 2 }))).toEqual(defaultsForward);
  });

  test('d1a: moved page retains default appearance independently of its index', async () => {
    const result = await state(await move(await defaultsPdf(), { from: 0, to: 2 }));
    expect(result.find((page) => page.w === 100)).toEqual(pageState(100));
  });

  test('d2: organize forward move preserves absent defaults', async () => {
    const result = await organize(await defaultsPdf(), [{ type: 'move', data: { from: 0, to: 2 } }]);
    expect(await state(result)).toEqual(defaultsForward);
  });

  test('d3: backward move preserves inherited rotation and CropBox', async () => {
    expect(await state(await move(await defaultsPdf(), { from: 3, to: 0 }))).toEqual(defaultsBackward);
  });
});