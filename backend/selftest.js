/**
 * Foundation Stabilization Self-Test
 * Tests all fixes without actually hitting a running server.
 * Validates logic paths at the service/module level.
 */

// Load env
require('dotenv').config();

const mongoose = require('mongoose');

async function runTests() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  FOUNDATION STABILIZATION — SELF TEST');
  console.log('═══════════════════════════════════════════\n');

  const results = [];
  const pass = (name) => { results.push({ name, status: '✅ PASS' }); console.log(`  ✅ ${name}`); };
  const fail = (name, err) => { results.push({ name, status: '❌ FAIL', error: err }); console.log(`  ❌ ${name}: ${err}`); };

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('  📦 MongoDB connected\n');
  } catch (e) {
    console.error('  ❌ Cannot connect to MongoDB:', e.message);
    process.exit(1);
  }

  const SetupService = require('./src/modules/setup/service');
  const AcademicYear = require('./src/models/AcademicYear');
  const ClassConfig = require('./src/models/ClassConfig');

  // ─── TEST 1: resolveAcademicYearId fallback ───────────────
  try {
    // First ensure there's an active year
    let activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      activeYear = await AcademicYear.create({
        name: 'Test-2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isActive: true,
      });
    }

    // Test: resolve without providing ID
    const resolved = await SetupService.resolveAcademicYearId(null);
    if (resolved && resolved.toString() === activeYear._id.toString()) {
      pass('resolveAcademicYearId fallback to active year');
    } else {
      fail('resolveAcademicYearId fallback', `Expected ${activeYear._id}, got ${resolved}`);
    }

    // Test: resolve with explicit ID
    const resolvedExplicit = await SetupService.resolveAcademicYearId(activeYear._id.toString());
    if (resolvedExplicit.toString() === activeYear._id.toString()) {
      pass('resolveAcademicYearId with explicit ID');
    } else {
      fail('resolveAcademicYearId explicit', 'Did not return provided ID');
    }
  } catch (e) {
    fail('resolveAcademicYearId', e.message);
  }

  // ─── TEST 2: validateClassForYear graceful ────────────────
  try {
    const fakeClassId = new mongoose.Types.ObjectId();
    const fakeYearId = new mongoose.Types.ObjectId();

    // Should NOT throw when no configs exist for that year
    const result = await SetupService.validateClassForYear(fakeClassId, fakeYearId);
    if (result === null) {
      pass('validateClassForYear — graceful when no configs exist');
    } else {
      fail('validateClassForYear graceful', 'Expected null');
    }
  } catch (e) {
    fail('validateClassForYear graceful', e.message);
  }

  // ─── TEST 3: Admission model accepts null academicYearId ──
  try {
    const Admission = require('./src/models/Admission');
    const testAdmission = new Admission({
      applicationNo: 'TEST-SELFTEST-001',
      studentName: 'Test Student',
      dateOfBirth: new Date('2015-01-01'),
      gender: 'male',
      classId: new mongoose.Types.ObjectId(),
      parentName: 'Test Parent',
      parentPhone: '9999999999',
    });
    // academicYearId not set — should default to null, not throw
    const err = testAdmission.validateSync();
    if (!err) {
      pass('Admission model — academicYearId is optional (backward compat)');
    } else {
      fail('Admission model optional academicYearId', err.message);
    }
  } catch (e) {
    fail('Admission model optional academicYearId', e.message);
  }

  // ─── TEST 4: Exam model accepts null academicYearId ───────
  try {
    const Exam = require('./src/models/Exam');
    const testExam = new Exam({
      name: 'Test Exam',
      classId: new mongoose.Types.ObjectId(),
      subjects: [{ subjectId: new mongoose.Types.ObjectId(), maxMarks: 100, passingMarks: 35 }],
    });
    const err = testExam.validateSync();
    if (!err) {
      pass('Exam model — academicYearId optional + subjects have passingMarks');
    } else {
      fail('Exam model optional fields', err.message);
    }
  } catch (e) {
    fail('Exam model optional fields', e.message);
  }

  // ─── TEST 5: FeeStructure model accepts null academicYearId
  try {
    const FeeStructure = require('./src/models/FeeStructure');
    const testFee = new FeeStructure({
      classId: new mongoose.Types.ObjectId(),
      totalAmount: 50000,
    });
    const err = testFee.validateSync();
    if (!err) {
      pass('FeeStructure model — academicYearId is optional (backward compat)');
    } else {
      fail('FeeStructure model optional academicYearId', err.message);
    }
  } catch (e) {
    fail('FeeStructure model optional academicYearId', e.message);
  }

  // ─── TEST 6: ExamService._computeGrade works ─────────────
  try {
    const ExamService = require('./src/modules/exam/service');
    const grades = [
      [95, 100, 'A+'],
      [85, 100, 'A'],
      [75, 100, 'B+'],
      [65, 100, 'B'],
      [55, 100, 'C'],
      [40, 100, 'D'],
      [20, 100, 'F'],
    ];
    let allCorrect = true;
    for (const [obtained, max, expected] of grades) {
      const result = ExamService._computeGrade(obtained, max);
      if (result !== expected) {
        allCorrect = false;
        fail('Grade computation', `Expected ${expected} for ${obtained}/${max}, got ${result}`);
        break;
      }
    }
    if (allCorrect) pass('Grade computation — all thresholds correct');
  } catch (e) {
    fail('Grade computation', e.message);
  }

  // ─── TEST 7: ApiResponse signature check ──────────────────
  try {
    const ApiResponse = require('./src/utils/apiResponse');
    // Simulate a mock res object
    let capturedStatus, capturedBody;
    const mockRes = {
      status: (code) => { capturedStatus = code; return mockRes; },
      json: (body) => { capturedBody = body; return mockRes; },
    };
    ApiResponse.success(mockRes, { test: true }, 'OK');
    if (capturedStatus === 200 && capturedBody.success === true && capturedBody.data.test === true) {
      pass('ApiResponse.success(res, data, msg) — correct signature');
    } else {
      fail('ApiResponse signature', `Unexpected output: ${JSON.stringify(capturedBody)}`);
    }
  } catch (e) {
    fail('ApiResponse signature', e.message);
  }

  // ─── SUMMARY ──────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════');
  const passed = results.filter((r) => r.status.includes('PASS')).length;
  const failed = results.filter((r) => r.status.includes('FAIL')).length;
  console.log(`\n  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('  ⚠️  Some tests failed. Review above.\n');
  } else {
    console.log('  🎉 All tests passed! System is stable.\n');
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
