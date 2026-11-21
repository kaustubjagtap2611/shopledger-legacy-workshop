var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures match the amounts charged by checkout for HSN GST and coupon discount', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 1, date: '2026-11-21', items: items, coupon: 'WELCOME',
    subtotal: ledgerFigures.subtotal, discount: ledgerFigures.discount,
    tax: ledgerFigures.tax, total: ledgerFigures.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total
  }, {
    subtotal: ledgerFigures.subtotal,
    discount: ledgerFigures.discount,
    tax: ledgerFigures.tax,
    cgst: ledgerFigures.cgst,
    sgst: ledgerFigures.sgst,
    total: ledgerFigures.total
  });
});

test('invoice uses checkout HSN slab GST', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, '');
  var order = {
    id: 1, date: '2026-11-21', items: items, coupon: '',
    subtotal: ledgerFigures.subtotal, discount: ledgerFigures.discount,
    tax: ledgerFigures.tax, total: ledgerFigures.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: ledgerFigures.subtotal, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { subtotal: 100, tax: 5, total: 105 });
  assert.deepEqual({ subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, total: invoiceFigures.total,
    cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst },
  { subtotal: 100, tax: 5, total: 105, cgst: 2.5, sgst: 2.5 });
});

test('invoice applies percentage coupon to the subtotal as checkout does', function () {
  var items = [{ id: 2, name: 'Misc', hsn: '9999', price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 2, date: '2026-11-21', items: items, coupon: 'WELCOME',
    subtotal: ledgerFigures.subtotal, discount: ledgerFigures.discount,
    tax: ledgerFigures.tax, total: ledgerFigures.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: ledgerFigures.subtotal, discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 });
  assert.deepEqual({ subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: 100, discount: 5, tax: 17.1, total: 112.1 });
});

test('GST reconciliation matches invoice and checkout tax and totals', function () {
  var items = [{ id: 2, name: 'Misc', hsn: '9999', price: 100, qty: 1 }];
  var totals = pricing.computeTotals(items, 'WELCOME');
  var db = { orders: [{
    id: 3, date: '2026-11-21', customer: 'Test Customer', items: items, coupon: 'WELCOME',
    subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total
  }] };
  var result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 17.1);
  assert.equal(result.rows[0].invoiceTax, 17.1);
  assert.equal(result.rows[0].invoiceDiscount, 5);
});

