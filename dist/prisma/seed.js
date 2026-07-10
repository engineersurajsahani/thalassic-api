"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    await prisma.enrollment.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.seaServiceRecord.deleteMany({});
    await prisma.seafarerProfile.deleteMany({});
    await prisma.supportTicket.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.course.deleteMany({});
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    const seafarerUser = await prisma.user.create({
        data: {
            email: 'seafarer@example.com',
            password: passwordHash,
            name: 'John Doe',
            phone: '+919876543210',
            role: 'seafarer',
            profile: {
                create: {
                    dob: '1995-05-15',
                    nationality: 'Indian',
                    indosNumber: '22GL1234',
                    address: '123 Marine Drive, Mumbai, India',
                    profilePicture: '',
                    seaService: {
                        create: [
                            {
                                vesselName: 'Pacific Sovereign',
                                imoNumber: 'IMO9123456',
                                rank: 'Third Officer',
                                signOn: '2025-01-10',
                                signOff: '2025-06-15',
                                company: 'Maersk Line',
                            },
                            {
                                vesselName: 'Atlantic Express',
                                imoNumber: 'IMO9876543',
                                rank: 'Cadet',
                                signOn: '2024-03-01',
                                signOff: '2024-09-01',
                                company: 'MSC Shipping',
                            }
                        ]
                    }
                }
            }
        }
    });
    const masterUser = await prisma.user.create({
        data: {
            email: 'master@example.com',
            password: passwordHash,
            name: 'Captain Richard',
            phone: '+911234567890',
            role: 'master',
        }
    });
    console.log('Users created:');
    console.log(`- Seafarer: ${seafarerUser.email} (pass: password123)`);
    console.log(`- Master: ${masterUser.email} (pass: password123)`);
    const coursesData = [
        {
            code: "BST",
            name: "Basic Safety Training",
            description: "Personal Survival Techniques (PST), Personal Safety & Social Responsibility (PSSR), Elementary First Aid (EFA), and Fire Prevention & Fire Fighting (FPFF).",
            duration: "12 Days",
            level: "Entry Level",
            icon: "🎯",
            category: "basic",
            image: "/images/courses/basic_safety_training.jpg",
            fees: "₹15,000",
            documentsRequired: "Passport Copy, Medical Fitness Certificate (DGS Approved Doctor), 10th Standard Marksheet, INDOS Registration Copy",
            rating: 4.8,
            ratingCount: 342
        },
        {
            code: "STSDSD",
            name: "Security Training for Seafarers with Designated Security Duties",
            description: "Comprehensive training on security threats, search procedures, piracy mitigation, and shipboard security plan execution.",
            duration: "2 Days",
            level: "Entry Level",
            icon: "🚢",
            category: "basic",
            image: "/images/courses/basic_safety_training.jpg",
            fees: "₹12,000",
            documentsRequired: "Passport Copy, Medical Certificate, Basic Safety Training Certificate",
            rating: 4.9,
            ratingCount: 188
        },
        {
            code: "OCTCO",
            name: "Oil & Chemical Tanker Cargo Operations",
            description: "Familiarization training covering tanker designs, cargo properties, safety hazards, emergency actions, and pollution prevention.",
            duration: "6 Days",
            level: "Entry Level",
            icon: "🎯",
            category: "basic",
            image: "/images/courses/basic_safety_training.jpg",
            fees: "₹18,000",
            documentsRequired: "Passport Copy, Medical Certificate, Basic Safety Training (BST) Certificate, INDOS Copy",
            rating: 4.7,
            ratingCount: 124
        },
        {
            code: "PSCRB",
            name: "Proficiency in Survival Craft and Rescue Boats",
            description: "Training in launching, handling, and operating survival craft and rescue boats in emergency situations.",
            duration: "5 Days",
            level: "Advanced",
            icon: "⚓",
            category: "advanced",
            image: "/images/courses/advanced_navigation.jpg",
            fees: "₹22,000",
            documentsRequired: "Passport Copy, Basic Safety Training Certificate, Valid Medical Certificate",
            rating: 4.8,
            ratingCount: 95
        },
        {
            code: "AFF",
            name: "Advanced Fire Fighting",
            description: "Advanced shipboard firefighting operations, including team coordination, tactical deployment, and breathing apparatus training.",
            duration: "6 Days",
            level: "Advanced",
            icon: "🔥",
            category: "advanced",
            image: "/images/courses/firefighting_drill.jpg",
            fees: "₹25,000",
            documentsRequired: "Passport Copy, Basic Safety Training Certificate, Valid Medical Certificate",
            rating: 4.9,
            ratingCount: 110
        },
        {
            code: "MFA",
            name: "Medical First Aid",
            description: "Theoretical and practical training in providing immediate medical care on board ship in case of accidents or illness.",
            duration: "4 Days",
            level: "Advanced",
            icon: "🩺",
            category: "advanced",
            image: "/images/courses/advanced_navigation.jpg",
            fees: "₹16,000",
            documentsRequired: "Passport Copy, Basic Safety Training Certificate, Valid Medical Certificate",
            rating: 4.6,
            ratingCount: 82
        },
        {
            code: "GMDSS",
            name: "Global Maritime Distress and Safety System",
            description: "Radio communication training covering distress, urgency, safety, and routine messaging protocols on MF, HF, and VHF systems.",
            duration: "12 Days",
            level: "Advanced",
            icon: "📡",
            category: "advanced",
            image: "/images/courses/tanker_cargo_operations.jpg",
            fees: "₹35,000",
            documentsRequired: "Passport Copy, INDOS Copy, Basic Safety Training Certificate, Valid Medical Certificate",
            rating: 4.8,
            ratingCount: 145
        }
    ];
    for (const course of coursesData) {
        await prisma.course.create({
            data: course
        });
    }
    console.log('Courses seeded.');
    await prisma.notification.createMany({
        data: [
            {
                userId: seafarerUser.id,
                title: 'Welcome to Hari Om Thalassic',
                message: 'Your profile has been created. Please upload your documents to begin verification.',
                isRead: false,
            },
            {
                userId: seafarerUser.id,
                title: 'New Course Available',
                message: 'Basic Safety Training (BST) course registration is open for next month.',
                isRead: false,
            }
        ]
    });
    console.log('Notifications seeded.');
    console.log('Seeding completed successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map