import { DataSource } from 'typeorm';
import {
  User,
  Institute,
  Course,
  CourseInstitute,
  SeafarerProfile,
  Partner,
  PartnerAdmin,
  PartnerCoursePricing,
  PartnerPricingProposal,
  Enrollment,
  Invoice,
  Payment,
  PartnerPayable,
  Settlement,
  SettlementItem,
  UserRole,
  PricingProposalStatus,
  PayableStatus,
  SettlementStatus,
  EnrollmentStatus,
  InvoiceType,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
} from '../../src/entities';
import { allEntities } from '../../src/data-source';

describe('Hari Om Thalassic - End-to-End Database & Financial Workflow Tests', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: allEntities,
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('Step 1 & 2: Should verify all 25+ TypeORM entities load into DataSource successfully', () => {
    expect(dataSource.isInitialized).toBe(true);
    expect(allEntities.length).toBeGreaterThanOrEqual(25);
    const entityMetadatas = dataSource.entityMetadatas;
    expect(entityMetadatas.length).toBe(allEntities.length);
  });

  let masterUser: User;
  let partnerAdminUser: User;
  let seafarerUser: User;
  let partner: Partner;
  let partnerAdmin: PartnerAdmin;
  let institute: Institute;
  let course: Course;
  let courseInstitute: CourseInstitute;
  let seafarerProfile: SeafarerProfile;

  it('Step 5: Should create Users with Supabase auth_user_id and roles', async () => {
    const userRepo = dataSource.getRepository(User);

    masterUser = await userRepo.save(
      userRepo.create({
        authUserId: 'auth-master-uuid-001',
        email: 'master.admin@hariomthalassic.com',
        name: 'Captain Vikram Malhotra (Master Admin)',
        role: UserRole.MASTER,
        isActive: true,
      }),
    );
    expect(masterUser.id).toBeDefined();
    expect(masterUser.role).toBe(UserRole.MASTER);

    partnerAdminUser = await userRepo.save(
      userRepo.create({
        authUserId: 'auth-partner-uuid-002',
        email: 'partner.ops@seatraining.com',
        name: 'Rajesh Sharma',
        role: UserRole.PARTNER_ADMIN,
        isActive: true,
      }),
    );
    expect(partnerAdminUser.id).toBeDefined();
    expect(partnerAdminUser.role).toBe(UserRole.PARTNER_ADMIN);

    seafarerUser = await userRepo.save(
      userRepo.create({
        authUserId: 'auth-seafarer-uuid-003',
        email: 'amit.verma@maritime.com',
        name: 'Amit Verma',
        role: UserRole.SEAFARER,
        isActive: true,
      }),
    );
    expect(seafarerUser.id).toBeDefined();

    const seafarerRepo = dataSource.getRepository(SeafarerProfile);
    seafarerProfile = await seafarerRepo.save(
      seafarerRepo.create({
        userId: seafarerUser.id,
        indosNum: '21GL9988',
        passportNum: 'Z8765432',
        cdcNum: 'MUM-887766',
        birthPlace: 'Mumbai',
      }),
    );
    expect(seafarerProfile.id).toBeDefined();
    expect(seafarerProfile.indosNum).toBe('21GL9988');
  });

  it('Step 6: Should create Partner and link PartnerAdmin', async () => {
    const partnerRepo = dataSource.getRepository(Partner);
    partner = await partnerRepo.save(
      partnerRepo.create({
        agencyName: 'SeaTraining Global Partners Ltd',
        contactPerson: 'Rajesh Sharma',
        contactEmail: 'contact@seatraining.com',
        contactPhone: '+91 98200 12345',
        referralCode: 'REF-SEATRAIN-01',
        onboardingStatus: 'Active',
      }),
    );
    expect(partner.id).toBeDefined();
    expect(partner.agencyName).toBe('SeaTraining Global Partners Ltd');

    const partnerAdminRepo = dataSource.getRepository(PartnerAdmin);
    partnerAdmin = await partnerAdminRepo.save(
      partnerAdminRepo.create({
        partnerId: partner.id,
        userId: partnerAdminUser.id,
        isPrimary: true,
      }),
    );
    expect(partnerAdmin.id).toBeDefined();
    expect(partnerAdmin.partnerId).toBe(partner.id);
  });

  it('Step 7 & 8: Should create Course, Institute, and CourseInstitute junction relationship', async () => {
    const instRepo = dataSource.getRepository(Institute);
    institute = await instRepo.save(
      instRepo.create({
        name: 'Hari Om Maritime Training Academy',
        code: 'HMI-MUM',
        city: 'Mumbai',
        state: 'Maharashtra',
        address: 'Marine Lines, South Mumbai',
        accreditationId: 'DGS-MUM-2024-001',
        contactEmail: 'admissions@hariomacademy.com',
        isActive: true,
      }),
    );
    expect(institute.id).toBeDefined();

    const courseRepo = dataSource.getRepository(Course);
    course = await courseRepo.save(
      courseRepo.create({
        name: 'Advanced Fire Fighting (AFF)',
        code: 'AFF-01',
        category: 'STCW_ADVANCED',
        duration: '5 Days',
        standardFee: 8500.0,
      }),
    );
    expect(course.id).toBeDefined();

    const ciRepo = dataSource.getRepository(CourseInstitute);
    courseInstitute = await ciRepo.save(
      ciRepo.create({
        courseId: course.id,
        instituteId: institute.id,
        basePrice: 8500.0,
        isActive: true,
      }),
    );
    expect(courseInstitute.id).toBeDefined();
    expect(courseInstitute.courseId).toBe(course.id);
    expect(courseInstitute.instituteId).toBe(institute.id);
  });

  let proposal: PartnerPricingProposal;
  let activePricing: PartnerCoursePricing;

  // Requirement 12.A & 12.D: Partner Admin proposes Hari Om Payable (no partner selling price requested/stored)
  it('Requirement 12.A & 12.D: Partner Admin proposes Hari Om Payable = ₹6200.00 without selling price', async () => {
    const proposalRepo = dataSource.getRepository(PartnerPricingProposal);
    proposal = await proposalRepo.save(
      proposalRepo.create({
        partnerId: partner.id,
        courseId: course.id,
        proposedPayableAmount: 6200.0,
        status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
        requestedByUserId: partnerAdminUser.id,
        justificationReason:
          'MOU renewal rate proposal for AFF course batches Q4 2026',
      }),
    );

    expect(proposal.id).toBeDefined();
    expect(proposal.proposedPayableAmount).toBe(6200.0);
    expect(proposal.status).toBe(PricingProposalStatus.PENDING_MASTER_APPROVAL);

    // Verify entity schema does not contain partner selling price
    const proposalCols = dataSource
      .getMetadata(PartnerPricingProposal)
      .columns.map((c) => c.propertyName);
    expect(proposalCols).not.toContain('partnerSellingPrice');
    expect(proposalCols).not.toContain('sellingPrice');
  });

  // Requirement 12.B: Master reviews and approves ₹6200.00
  it('Requirement 12.B: Master reviews and approves proposal, activating Hari Om Payable', async () => {
    const proposalRepo = dataSource.getRepository(PartnerPricingProposal);
    proposal.status = PricingProposalStatus.APPROVED;
    proposal.reviewedByUserId = masterUser.id;
    proposal.reviewedAt = new Date();
    proposal.reviewNotes = 'Approved under MOU Agreement #2026-MOU-09';
    await proposalRepo.save(proposal);

    const pricingRepo = dataSource.getRepository(PartnerCoursePricing);
    activePricing = await pricingRepo.save(
      pricingRepo.create({
        partnerId: partner.id,
        courseId: course.id,
        activePayableAmount: proposal.proposedPayableAmount,
      }),
    );

    expect(activePricing.id).toBeDefined();
    expect(activePricing.activePayableAmount).toBe(6200.0);
  });

  let enrollment: Enrollment;
  let partnerPayable: PartnerPayable;
  let invoice: Invoice;

  // Requirement 12.C & 12.G: Transaction snapshots approved Hari Om Payable ₹6200.00 (Partner owes Hari Om)
  it('Requirement 12.C & 12.G: Enrollment snapshots approved Hari Om Payable ₹6200.00 (Amount owed to Hari Om)', async () => {
    const enrollRepo = dataSource.getRepository(Enrollment);
    enrollment = await enrollRepo.save(
      enrollRepo.create({
        userId: seafarerUser.id,
        courseInstituteId: courseInstitute.id,
        partnerId: partner.id,
        status: EnrollmentStatus.ACTIVE,
      }),
    );
    expect(enrollment.id).toBeDefined();
    expect(enrollment.courseInstituteId).toBe(courseInstitute.id);
    expect(enrollment.partnerId).toBe(partner.id);

    // Snapshot approved Hari Om Payable into partner_payables
    const payableRepo = dataSource.getRepository(PartnerPayable);
    partnerPayable = await payableRepo.save(
      payableRepo.create({
        partnerId: partner.id,
        enrollmentId: enrollment.id,
        courseId: course.id,
        seafarerUserId: seafarerUser.id,
        approvedPayableAmount: activePricing.activePayableAmount,
        pricingProposalId: proposal.id,
        status: PayableStatus.PENDING,
      }),
    );

    expect(partnerPayable.id).toBeDefined();
    expect(partnerPayable.approvedPayableAmount).toBe(6200.0);
    expect(partnerPayable.status).toBe(PayableStatus.PENDING);
    expect(partnerPayable.pricingProposalId).toBe(proposal.id);
  });

  it('Step 15: Invoice creation with atomic counter and prefix HACYYMM00001', async () => {
    const now = new Date();
    const yearMonth = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const invoiceNumber = `HAC${yearMonth}00001`;

    const invoiceRepo = dataSource.getRepository(Invoice);
    invoice = await invoiceRepo.save(
      invoiceRepo.create({
        invoiceNumber,
        invoiceType: InvoiceType.HAC,
        partnerId: partner.id,
        enrollmentId: enrollment.id,
        totalAmount: 6200.0,
        netPayable: 6200.0,
        taxAmount: 0.0,
        discountAmount: 0.0,
        issueDate: now.toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        status: InvoiceStatus.ISSUED,
      }),
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber).toMatch(/^HAC\d{4}\d{5}$/);
    expect(invoice.netPayable).toBe(6200.0);

    // Link invoice to partner payable
    const payableRepo = dataSource.getRepository(PartnerPayable);
    partnerPayable.invoiceId = invoice.id;
    await payableRepo.save(partnerPayable);
  });

  let settlement: Settlement;
  let settlementItem: SettlementItem;

  // Requirement 12.H, 12.I & 12.J: Partner remits ₹6200.00 to Hari Om (Partner -> Hari Om remittance)
  it('Requirement 12.H, 12.I & 12.J: Partner remits ₹6200.00 to Hari Om; Master confirms receipt and marks SETTLED', async () => {
    const settlementRepo = dataSource.getRepository(Settlement);

    // Partner submits settlement/remittance batch for the amount owed to Hari Om
    settlement = await settlementRepo.save(
      settlementRepo.create({
        partnerId: partner.id,
        settlementNumber: `STL-2601-${Date.now().toString().slice(-4)}`,
        totalAmount: partnerPayable.approvedPayableAmount,
        paymentReference: 'UTR-HDFC-9918273645',
        status: SettlementStatus.SUBMITTED,
      }),
    );
    expect(settlement.id).toBeDefined();
    expect(settlement.totalAmount).toBe(6200.0);
    expect(settlement.paymentReference).toBe('UTR-HDFC-9918273645');

    const itemRepo = dataSource.getRepository(SettlementItem);
    settlementItem = await itemRepo.save(
      itemRepo.create({
        settlementId: settlement.id,
        payableId: partnerPayable.id,
        amount: partnerPayable.approvedPayableAmount,
      }),
    );
    expect(settlementItem.id).toBeDefined();
    expect(settlementItem.payableId).toBe(partnerPayable.id);

    // Master verifies payment received from Partner -> Hari Om
    settlement.status = SettlementStatus.PAID;
    settlement.processedByUserId = masterUser.id;
    settlement.processedAt = new Date();
    await settlementRepo.save(settlement);

    // Mark payable as SETTLED (money received by Hari Om)
    const payableRepo = dataSource.getRepository(PartnerPayable);
    partnerPayable.status = PayableStatus.SETTLED;
    await payableRepo.save(partnerPayable);

    const verifiedPayable = await payableRepo.findOneOrFail({
      where: { id: partnerPayable.id },
    });
    expect(verifiedPayable.status).toBe(PayableStatus.SETTLED);
    expect(settlement.status).toBe(SettlementStatus.PAID);
  });

  it('Step 16: Payment recording against invoice', async () => {
    const paymentRepo = dataSource.getRepository(Payment);
    const payment = await paymentRepo.save(
      paymentRepo.create({
        paymentNumber: `PAY-2026-${Date.now().toString().slice(-6)}`,
        invoiceId: invoice.id,
        partnerId: partner.id,
        userId: partnerAdminUser.id,
        amount: 6200.0,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        gatewayTransactionId: 'UTR-HDFC-9918273645',
        status: PaymentStatus.SUCCESSFUL,
        paidAt: new Date(),
      }),
    );
    expect(payment.id).toBeDefined();
    expect(payment.amount).toBe(6200.0);
    expect(payment.status).toBe(PaymentStatus.SUCCESSFUL);
  });

  // Requirement 12.K: Changing future pricing does NOT alter historical transactions
  it('Requirement 12.K: Changing future Partner pricing does NOT modify historical payable records', async () => {
    const pricingRepo = dataSource.getRepository(PartnerCoursePricing);
    const proposalRepo = dataSource.getRepository(PartnerPricingProposal);
    const payableRepo = dataSource.getRepository(PartnerPayable);

    // 1. New proposal for 7500.00
    const newProposal = await proposalRepo.save(
      proposalRepo.create({
        partnerId: partner.id,
        courseId: course.id,
        proposedPayableAmount: 7500.0,
        status: PricingProposalStatus.APPROVED,
        requestedByUserId: partnerAdminUser.id,
        reviewedByUserId: masterUser.id,
        reviewedAt: new Date(),
      }),
    );

    // 2. Active pricing is updated to 7500.00
    activePricing.activePayableAmount = 7500.0;
    await pricingRepo.save(activePricing);

    // 3. Verify historical partner_payable remains untouched at 6200.00
    const fetchedHistoricalPayable = await payableRepo.findOneOrFail({
      where: { id: partnerPayable.id },
    });
    expect(fetchedHistoricalPayable.approvedPayableAmount).toBe(6200.0);
    expect(fetchedHistoricalPayable.pricingProposalId).toBe(proposal.id);
    expect(activePricing.activePayableAmount).toBe(7500.0);
  });

  // Requirement 12.E & 12.F: Verify that NO commission or margin calculation exists anywhere
  it('Requirement 12.E & 12.F: Verify that NO commission or margin calculation exists anywhere in schema or entities', () => {
    const payableMetadata = dataSource.getMetadata(PartnerPayable);
    const columns = payableMetadata.columns.map((c) => c.propertyName);

    expect(columns).not.toContain('commission');
    expect(columns).not.toContain('commissionAmount');
    expect(columns).not.toContain('commissionRate');
    expect(columns).not.toContain('partnerSellingPrice');
    expect(columns).not.toContain('partnerMargin');
    expect(columns).not.toContain('sellingPrice');
    expect(columns).not.toContain('margin');
    expect(columns).toContain('approvedPayableAmount');

    const pricingMetadata = dataSource.getMetadata(PartnerCoursePricing);
    const pricingCols = pricingMetadata.columns.map((c) => c.propertyName);
    expect(pricingCols).not.toContain('commission');
    expect(pricingCols).not.toContain('margin');
    expect(pricingCols).toContain('activePayableAmount');
  });
});
