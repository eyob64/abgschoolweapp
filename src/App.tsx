/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, FormEvent, useEffect, ChangeEvent, Fragment } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Analytics } from '@vercel/analytics/react';
import { GoogleGenAI } from "@google/genai";

// Firebase imports
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Language = 'en' | 'am';

const translations = {
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      admissions: 'Admissions',
      academics: 'Academics',
      faculty: 'Faculty',
      blog: 'Blog',
      events: 'Events',
      contact: 'Contact',
      dashboard: 'Dashboard',
      login: 'Login',
      logout: 'Logout'
    },
    hero: {
      welcome: 'Welcome to Abune Gorgorios School',
      title: 'Shaping Minds, Building Futures.',
      subtitle: 'Discover a place where academic excellence meets character building. Stay connected with our vibrant community.',
      ctaPrimary: 'Explore Blog',
      ctaSecondary: 'Latest News'
    },
    home: {
      features: [
        { title: 'Academic Excellence', desc: 'Rigorous curriculum designed to challenge and inspire students.' },
        { title: 'Character Building', desc: 'Focus on ethics, leadership, and community responsibility.' },
        { title: 'Vibrant Community', desc: 'A supportive environment for students, parents, and faculty.' }
      ],
      newsTitle: 'Latest News.',
      newsSubtitle: 'Stay informed about the latest happenings, announcements, and achievements at Abune Gorgorios School.',
      viewAllNews: 'View All News',
      readMore: 'Read More'
    },
    about: {
      heroTitle: 'A Legacy of Excellence.',
      heroSubtitle: 'Discover the heart of Abune Gorgorios School, where we\'ve been shaping minds and building futures for over three decades.',
      established: 'Established 1995',
      principalMessage: '"Our goal is not just to teach students how to make a living, but how to live a life of purpose and integrity."',
      principalWelcome: 'Welcome to Abune Gorgorios School. As we look back on our journey since 1995, I am filled with immense pride at the community we have built together. Our school is more than just a place of learning; it is a sanctuary where curiosity is nurtured, character is forged, and dreams are given wings.',
      journeyBadge: 'OUR JOURNEY',
      journeyTitle: 'Three Decades of Growth.',
      journeyDesc: 'From our humble beginnings to our current status as a leading educational institution, every step of our journey has been guided by our commitment to excellence.',
    },
    common: {
      readMore: 'Read More',
      close: 'Close',
      back: 'Back',
      send: 'Send',
    },
    admissions: {
      title: 'Join Our Community.',
      subtitle: 'Start your journey with Abune Gorgorios School today. We welcome students who are eager to learn, grow, and contribute to our vibrant community.',
      formTitle: 'Admission Application',
      studentName: 'Student Full Name',
      gradeApplying: 'Grade Applying For',
      guardianName: 'Guardian Full Name',
      guardianPhone: 'Guardian Phone Number',
      guardianEmail: 'Guardian Email Address',
      previousSchool: 'Previous School Attended',
      lastGrade: 'Last Grade Completed',
      submit: 'Submit Application',
      success: 'Application Submitted Successfully!',
      successMsg: 'Thank you for applying. Our admissions team will review your application and contact you shortly.',
      steps: [
        { step: '01', title: 'Online Registration', desc: 'Fill out the initial registration form with student and guardian details.' },
        { step: '02', title: 'Document Submission', desc: 'Provide previous school records, birth certificate, and ID photos.' },
        { step: '03', title: 'Entrance Assessment', desc: 'Students will undergo a placement test in Mathematics and English.' },
        { step: '04', title: 'Family Interview', desc: 'A meeting with our admissions committee to discuss goals and expectations.' }
      ],
      formSectionStudent: 'Student Information',
      formSectionGuardian: 'Guardian Information',
      formSectionAcademic: 'Academic Background',
      placeholderName: "Enter student's full name",
      placeholderGrade: 'Select Grade',
      placeholderGuardian: 'Enter parent/guardian name',
      placeholderPhone: '+251 XXX XXX XXX',
      placeholderEmail: 'email@example.com',
      placeholderSchool: 'Name of last school',
      placeholderLastGrade: 'e.g. Grade 9',
      submitAnother: 'Submit another application'
    },
    aboutPage: {
      milestones: [
        { year: '1995', title: 'The Beginning', desc: 'Abune Gorgorios School opens its doors with 50 students and 5 teachers, focusing on primary education.' },
        { year: '2002', title: 'Secondary Expansion', desc: 'We launched our secondary school program, expanding our campus to accommodate growing enrollment.' },
        { year: '2010', title: 'Digital Transformation', desc: 'Implementation of our first computer labs and integration of technology into the core curriculum.' },
        { year: '2018', title: 'STEM Excellence', desc: 'Opening of our state-of-the-art Science and Innovation Center, focusing on robotics and advanced sciences.' },
        { year: '2024', title: 'Modern Era', desc: 'Full digital integration with student portals, online resources, and a focus on global citizenship.' }
      ],
      foundationTitle: 'Our Core Foundation',
      foundationSubtitle: 'Everything we do is built upon these fundamental pillars of excellence and integrity.',
      missionTitle: 'Our Mission',
      missionDesc: 'To empower students with the knowledge, skills, and character necessary to succeed in a global society and contribute meaningfully to their communities.',
      visionTitle: 'Our Vision',
      visionDesc: 'To be a leading center of educational excellence that inspires lifelong learning, critical thinking, and global citizenship in every student.',
      valuesTitle: 'Our Values',
      values: [
        { t: 'Integrity', d: 'Doing the right thing, always.' },
        { t: 'Excellence', d: 'Striving for the highest standards.' },
        { t: 'Respect', d: 'Valuing every individual.' }
      ],
      leadershipBadge: 'Our Leadership',
      leadershipTitle: 'The Minds Behind Our Success.',
      leadershipSubtitle: 'Our leadership team brings decades of experience and a shared passion for transformative education.',
      viewAllFaculty: 'View All Faculty',
      accreditationBadge: 'Accreditation & Standards',
      accreditationTitle: 'Recognized for Quality.',
      accreditationDesc: 'Abune Gorgorios School is fully accredited by the Ministry of Education and meets all national standards for academic excellence. We are also proud members of several international educational associations.',
      journeyBadge: 'Our Journey',
      journeyTitle: 'Three Decades of Growth.',
      journeyDesc: 'From our humble beginnings to our current status as a leading educational institution, every step of our journey has been guided by our commitment to excellence.'
    },
    dashboard: {
      welcome: 'Welcome back',
      studentId: 'Student ID',
      employeeId: 'Employee ID',
      grade: 'Grade',
      enrolled: 'Enrolled',
      joined: 'Joined',
      editProfile: 'Edit Profile',
      quickResources: 'Quick Resources',
      upcomingClasses: 'Upcoming Classes',
      directorTools: 'Director Tools',
      systemMessages: 'System Messages',
      new: 'New',
      noMessages: 'No new messages',
      directorTitle: 'School Director',
      createPost: 'Create Post',
      recentBlog: 'Recent Blog Posts',
      schoolNews: 'School News & Announcements',
      viewAll: 'View All',
      studentManagement: 'Student Management',
      studentManagementDesc: 'View and manage student profiles',
      addStudent: 'Add Student',
      tableStudent: 'Student',
      tableGrade: 'Grade',
      tableId: 'Student ID',
      tableActions: 'Actions',
      totalStudents: 'Total Students',
      staffMembers: 'Staff Members',
      activeEvents: 'Active Events',
      searchPlaceholder: 'Search by name, ID or email...',
      filterAll: 'All Grades',
      noStudents: 'No students found matching your criteria.',
      sortLabel: 'Sort Students',
      sortAsc: 'ID: Ascending',
      sortDesc: 'ID: Descending',
      sortGradeAsc: 'Grade: Ascending',
      sortGradeDesc: 'Grade: Descending',
      photoUrl: 'Profile Photo URL',
      generateAI: 'Generate with AI',
      sendMessage: 'Send Message',
      messages: 'Messages',
      messagePlaceholder: 'Type your message here...',
      categoryAcademic: 'Academic',
      categoryBehavior: 'Behavior',
      categoryGeneral: 'General',
      categoryUrgent: 'Urgent',
      noStudentMessages: 'No messages yet.',
      fromDirector: 'From Director',
      myEvents: 'My Registered Events',
      noRegisteredEvents: 'You haven\'t registered for any events yet.',
      currentGrades: 'Current Grades',
      upcomingAssignments: 'Upcoming Assignments',
      subject: 'Subject',
      status: 'Status',
      dueDate: 'Due Date',
      math: 'Mathematics',
      physics: 'Physics',
      history: 'History',
      english: 'English',
      biology: 'Biology',
      chemistry: 'Chemistry',
      gradebook: 'Gradebook',
      assignmentStatus: 'Assignment Status',
      overallGrade: 'Overall Grade',
      attendance: 'Attendance',
      gpa: 'GPA',
      assignments: 'Assignments',
      score: 'Score',
      total: 'Total',
      date: 'Date',
      viewAssignments: 'View Assignments',
      postGrade: 'Post Grade',
      selectSubject: 'Select Subject',
      selectAssignment: 'Select Assignment',
      enterGrade: 'Enter Grade (e.g. A, B+)',
      enterAttendance: 'Attendance %',
      enterStatus: 'Status (e.g. On Track)',
      gradePosted: 'Grade posted successfully!',
      addNewAssignment: 'Add New Assignment',
      assignmentTitle: 'Assignment Title',
      manageCalendar: 'Manage Academic Calendar',
      manageCalendarDesc: 'Add, edit, and view important school dates and events.',
      addEvent: 'Add Event',
      editEvent: 'Edit Event',
      eventTitle: 'Event Title',
      eventDate: 'Event Date',
      eventTime: 'Time',
      eventLocation: 'Location',
      eventType: 'Event Type',
      eventDescription: 'Description',
      holiday: 'Holiday',
      exam: 'Exam Period',
      schoolEvent: 'School Event',
      saveEvent: 'Save Event',
      deleteEvent: 'Delete Event',
    },
    onboarding: {
      title: 'Welcome to Our School!',
      subtitle: 'Please complete your profile to get started.',
      fullName: 'Full Name',
      photoUrl: 'Profile Photo URL',
      placeholderName: 'Enter your full name',
      placeholderPhoto: 'https://example.com/photo.jpg',
      submit: 'Complete Profile'
    },
    faculty: [
      { name: "Dr. Abraham Tekle", title: "School Director", photo: "https://storage.googleapis.com/static.antigravity.ai/user_uploads/67e3d644-889a-487f-9988-660990477619/image.png", bio: "Dr. Abraham has over 20 years of experience in educational leadership. He is dedicated to fostering an environment where every student can achieve their full potential through academic excellence and character development." },
      { name: "Ms. Martha Gebre", title: "Head of Academics", bio: "Ms. Martha oversees our curriculum development and teacher training. She believes in a holistic approach to education that balances rigorous academics with creative expression." },
      { name: "Mr. Samuel Bekele", title: "Senior Mathematics Teacher", bio: "With a passion for numbers, Mr. Samuel makes complex mathematical concepts accessible and exciting for students of all levels." },
      { name: "Mrs. Helen Tadesse", title: "Science Department Head", bio: "Mrs. Helen brings science to life through hands-on experiments and inquiry-based learning, encouraging students to explore the wonders of the natural world." },
      { name: "Mr. Dawit Girma", title: "History & Social Studies", bio: "Mr. Dawit is passionate about helping students understand the past to better navigate the future. His classes are known for lively discussions and critical thinking." },
      { name: "Ms. Sara Yosef", title: "English Language Specialist", bio: "Ms. Sara focuses on developing strong communication skills and a love for literature in her students, preparing them for success in a globalized world." },
      { name: "Mr. Kassahun Tilahun", title: "Grade 8 Social Studies Teacher", bio: "Mr. Kassahun brings history and geography to life for our grade 8 students, fostering a deep understanding of our society and its development." },
      { name: "Ms. Tigist Alemu", title: "Grade 8 General Science Teacher", bio: "Ms. Tigist is passionate about science and technology, guiding grade 8 students through the fascinating world of general science with hands-on experiments." },
      { name: "Mr. Tolosa Gemechu", title: "Afaan Oromo Teacher", bio: "Mr. Tolosa is dedicated to teaching the Afaan Oromo language and culture, helping students develop strong linguistic skills and cultural appreciation." }
    ],
    events: [
      { title: "Annual Science Fair", location: "School Main Hall", description: "Students from all grades showcase their innovative science projects and experiments. Parents and community members are welcome to attend.", category: "Academic" },
      { title: "Inter-School Soccer Finals", location: "School Sports Ground", description: "Cheer for our school team as they compete in the regional finals. A day of excitement and school spirit!", category: "Sports" },
      { title: "Parent-Teacher Conference", location: "Respective Classrooms", description: "An opportunity for parents to discuss their child's academic progress and development with teachers.", category: "Academic" },
      { title: "Cultural Day Celebration", location: "School Courtyard", description: "Celebrating the rich diversity of our community through traditional music, dance, and food from various cultures.", category: "Social" },
      { title: "Easter Holiday Break", location: "Campus Wide", description: "School will be closed for the Easter holiday break. Classes will resume on the following Monday.", category: "Holiday" }
    ],
    eventModal: {
      closeDetails: 'Close Details',
      register: 'Confirm Registration',
      unregister: 'Cancel Registration',
      success: 'Registration Confirmed!',
      successMsg: 'You are all set for this event.',
      alreadyRegistered: 'You are already registered for this event.',
      registeredStudents: 'Registered Students'
    },
    gallery: [
      { title: 'Modern Science Lab', category: 'Facility' },
      { title: 'Student Basketball Match', category: 'Activity' },
      { title: 'Spacious Library', category: 'Facility' },
      { title: 'Art Workshop', category: 'Activity' },
      { title: 'Computer Laboratory', category: 'Facility' },
      { title: 'Outdoor Reading Area', category: 'Facility' },
      { title: 'Group Study Session', category: 'Activity' },
      { title: 'School Football Field', category: 'Facility' }
    ],
    blog: [
      { title: 'Welcome to our new website', content: 'We are excited to launch our new digital home. This platform will serve as a hub for all our school activities, news, and academic resources. Stay tuned for regular updates!' },
      { title: 'Academic Excellence Awards', content: 'Congratulations to all our high-achieving students who received awards this term. Your hard work and dedication continue to inspire us all.' }
    ],
    news: [
      { title: 'School Reopening Dates', content: 'Term 3 will begin on April 15th. We look forward to welcoming all students back for another productive term.' },
      { title: 'New Science Lab Equipment', content: 'We have received state-of-the-art equipment for our labs, enhancing our hands-on learning experience for science students.' }
    ],
    contactPage: {
      heroTitle: 'Get in Touch.',
      heroSubtitle: 'Have questions? We\'re here to help. Reach out to us through any of the channels below or send us a message directly.',
      infoTitle: 'Contact Information',
      infoSubtitle: 'Find us at our campus or reach out via phone or email.',
      formTitle: 'Send us a Message',
      formSubtitle: 'Fill out the form below and our team will get back to you as soon as possible.',
      nameLabel: 'Full Name',
      emailLabel: 'Email Address',
      subjectLabel: 'Subject',
      messageLabel: 'Your Message',
      submitButton: 'Send Message',
      successTitle: 'Message Sent!',
      successMessage: 'Thank you for reaching out. We have received your message and will get back to you shortly.',
      addressTitle: 'Our Location',
      phoneTitle: 'Phone Number',
      emailTitle: 'Email Address',
      hoursTitle: 'Office Hours',
      addressValue: 'Bole Sub-city, Addis Ababa, Ethiopia',
      phoneValue: '+251 11 123 4567',
      emailValue: 'info@abunegorgorios.edu.et',
      hoursValue: 'Mon - Fri: 8:00 AM - 5:00 PM',
      supportTitle: 'IT Support',
      supportDesc: 'For technical issues with the portal, please contact our support team.'
    },
    footer: {
      about: 'About Us',
      quickLinks: 'Quick Links',
      contact: 'Contact Us',
      rights: 'All rights reserved.'
    },
    payment: {
      title: 'Online Payment',
      subtitle: 'Pay your school fees securely online.',
      accountInfo: 'School Account Information',
      bankName: 'Commercial Bank of Ethiopia (CBE)',
      accountNumber: 'Account Number: 1000123456789',
      accountHolder: 'Account Holder: Abune Gorgorios School',
      tuitionFee: 'Tuition Fee',
      registrationFee: 'Registration Fee',
      totalAmount: 'Total Amount',
      paymentInstructions: 'Please include the student ID in the transaction description. After payment, upload your receipt in the dashboard.',
      payNow: 'Pay Now',
      uploadReceipt: 'Upload Receipt',
      price: 'Price',
      currency: 'ETB'
    }
  },
  am: {
    nav: {
      home: 'መነሻ',
      about: 'ስለ እኛ',
      admissions: 'ምዝገባ',
      academics: 'ትምህርት',
      faculty: 'መምህራን',
      blog: 'ብሎግ',
      events: 'ክስተቶች',
      contact: 'እውቂያ',
      dashboard: 'ዳሽቦርድ',
      login: 'ግባ',
      logout: 'ውጣ'
    },
    hero: {
      welcome: 'ወደ አቡነ ጎርጎርዮስ ትምህርት ቤት እንኳን ደህና መጡ',
      title: 'አእምሮን መቅረጽ፣ መጪውን ጊዜ መገንባት።',
      subtitle: 'የትምህርት ጥራት ከባህሪ ግንባታ ጋር የሚገናኝበትን ቦታ ያግኙ። ከደመቀው ማህበረሰባችን ጋር እንደተገናኙ ይቆዩ።',
      ctaPrimary: 'ብሎግ ያስሱ',
      ctaSecondary: 'የቅርብ ጊዜ ዜናዎች'
    },
    home: {
      features: [
        { title: 'የትምህርት ጥራት', desc: 'ተማሪዎችን ለመፈተን እና ለማነሳሳት የተነደፈ ጥብቅ ስርአተ ትምህርት።' },
        { title: 'የባህሪ ግንባታ', desc: 'በስነ-ምግባር፣ በመሪነት እና በማህበረሰብ ኃላፊነት ላይ ያተኮረ።' },
        { title: 'ደማቅ ማህበረሰብ', desc: 'ለተማሪዎች፣ ለወላጆች እና ለመምህራን ደጋፊ አካባቢ።' }
      ],
      newsTitle: 'የቅርብ ጊዜ ዜናዎች።',
      newsSubtitle: 'በአቡነ ጎርጎርዮስ ትምህርት ቤት ስለሚከናወኑ የቅርብ ጊዜ ክስተቶች፣ ማስታወቂያዎች እና ስኬቶች መረጃ ያግኙ።',
      viewAllNews: 'ሁሉንም ዜናዎች ይመልከቱ',
      readMore: 'ተጨማሪ ያንብቡ'
    },
    about: {
      heroTitle: 'የላቀ ውጤት ውርስ።',
      heroSubtitle: 'ለሦስት አስርት ዓመታት ያህል አእምሮን ስንቀርጽ እና የወደፊት ሕይወትን ስንገነባ የቆየንበትን የአቡነ ጎርጎርዮስ ትምህርት ቤት ልብ ያግኙ።',
      established: 'በ1987 ዓ.ም ተመሠረተ',
      principalMessage: '"ግባችን ተማሪዎች እንዴት መኖር እንደሚችሉ ማስተማር ብቻ ሳይሆን፣ ዓላማ ያለው እና ታማኝነት የተሞላበት ሕይወት እንዴት መኖር እንደሚችሉ ማስተማር ነው።"',
      principalWelcome: 'ወደ አቡነ ጎርጎርዮስ ትምህርት ቤት እንኳን ደህና መጡ። ከ1987 ዓ.ም ጀምሮ ያለውን ጉዟችንን ስንመለከት፣ አብረን በገነባነው ማህበረሰብ ታላቅ ኩራት ይሰማኛል። ትምህርት ቤታችን ከመማሪያ ቦታ በላይ ነው፤ የማወቅ ጉጉት የሚዳብርበት፣ ባህሪ የሚቀረጽበት እና ህልሞች ክንፍ የሚወጡበት ስፍራ ነው።',
      journeyBadge: 'የእኛ ጉዞ',
      journeyTitle: 'የሦስት አስርት ዓመታት እድገት።',
      journeyDesc: 'ከትሁት ጅማሮአችን ጀምሮ እስከ አሁኑ መሪ የትምህርት ተቋም ደረጃችን ድረስ፣ የእያንዳንዱ የጉዞአችን እርምጃ ለላቀ ውጤት ባለን ቁርጠኝነት የተመራ ነው።',
    },
    common: {
      readMore: 'ተጨማሪ ያንብቡ',
      close: 'ዝጋ',
      back: 'ተመለስ',
      send: 'ላክ',
    },
    admissions: {
      title: 'ማህበረሰባችንን ይቀላቀሉ።',
      subtitle: 'የአቡነ ጎርጎርዮስ ትምህርት ቤት ጉዞዎን ዛሬ ይጀምሩ። ለመማር፣ ለማደግ እና ለደመቀው ማህበረሰባችን አስተዋፅዖ ለማድረግ የሚጓጉ ተማሪዎችን እንቀበላለን።',
      formTitle: 'የመግቢያ ማመልከቻ',
      studentName: 'የተማሪ ሙሉ ስም',
      gradeApplying: 'የሚመዘገብበት ክፍል',
      guardianName: 'የወላጅ/አሳዳጊ ሙሉ ስም',
      guardianPhone: 'የወላጅ/አሳዳጊ ስልክ ቁጥር',
      guardianEmail: 'የወላጅ/አሳዳጊ ኢሜይል አድራሻ',
      previousSchool: 'ቀደም ሲል የተማረበት ትምህርት ቤት',
      lastGrade: 'የመጨረሻው የተጠናቀቀ ክፍል',
      submit: 'ማመልከቻውን አስገባ',
      success: 'ማመልከቻው በተሳካ ሁኔታ ተልኳል!',
      successMsg: 'ስላመለከቱ እናመሰግናለን። የምዝገባ ቡድናችን ማመልከቻዎን ገምግሞ በቅርቡ ያነጋግርዎታል።',
      steps: [
        { step: '01', title: 'የመስመር ላይ ምዝገባ', desc: 'የተማሪ እና የአሳዳጊ ዝርዝሮችን የያዘ የመጀመሪያ የምዝገባ ቅጽ ይሙሉ::' },
        { step: '02', title: 'ሰነድ ማስገባት', desc: 'የቀድሞ የትምህርት ቤት መዝገቦችን፣ የልደት የምስክር ወረቀት እና የመታወቂያ ፎቶዎችን ያቅርቡ::' },
        { step: '03', title: 'የመግቢያ ምዘና', desc: 'ተማሪዎች በሂሳብ እና በእንግሊዝኛ የደረጃ መፈተሻ ፈተና ይወስዳሉ::' },
        { step: '04', title: 'የቤተሰብ ቃለ መጠይቅ', desc: 'ስለ ግቦች እና የሚጠበቁ ነገሮች ለመወያየት ከምዝገባ ኮሚቴያችን ጋር የሚደረግ ስብሰባ::' }
      ],
      formSectionStudent: 'የተማሪ መረጃ',
      formSectionGuardian: 'የወላጅ/አሳዳጊ መረጃ',
      formSectionAcademic: 'የትምህርት ታሪክ',
      placeholderName: 'የተማሪውን ሙሉ ስም ያስገቡ',
      placeholderGrade: 'ክፍል ይምረጡ',
      placeholderGuardian: 'የወላጅ/አሳዳጊ ስም ያስገቡ',
      placeholderPhone: '+251 XXX XXX XXX',
      placeholderEmail: 'email@example.com',
      placeholderSchool: 'የመጨረሻው ትምህርት ቤት ስም',
      placeholderLastGrade: 'ለምሳሌ፡ 9ኛ ክፍል',
      submitAnother: 'ሌላ ማመልከቻ ያስገቡ'
    },
    aboutPage: {
      milestones: [
        { year: '1987', title: 'ጅማሮ', desc: 'አቡነ ጎርጎርዮስ ትምህርት ቤት በ50 ተማሪዎች እና በ5 መምህራን በዋናነት በአንደኛ ደረጃ ትምህርት ላይ በማተኮር በሩን ከፈተ።' },
        { year: '1994', title: 'የሁለተኛ ደረጃ መስፋፋት', desc: 'የሁለተኛ ደረጃ ትምህርት ፕሮግራማችንን በመጀመር፣ እያደገ የመጣውን የተማሪዎች ቁጥር ለማስተናገድ ግቢያችንን አስፋፍተናል።' },
        { year: '2002', title: 'ዲጂታል ሽግግር', desc: 'የመጀመሪያው የኮምፒውተር ላብራቶሪዎች ትግበራ እና ቴክኖሎጂን ከዋናው ስርአተ ትምህርት ጋር ማቀናጀት።' },
        { year: '2010', title: 'የSTEM የላቀ ውጤት', desc: 'በሮቦቲክስ እና በላቁ ሳይንሶች ላይ ያተኮረ ዘመናዊ የሳይንስ እና የፈጠራ ማዕከላችንን ከፈትን።' },
        { year: '2016', title: 'ዘመናዊ ዘመን', desc: 'ከተማሪ ፖርታሎች፣ የመስመር ላይ ግብአቶች እና በዓለም አቀፍ ዜግነት ላይ ካተኮረ ሙሉ የዲጂታል ውህደት ጋር።' }
      ],
      foundationTitle: 'የእኛ ዋና መሠረት',
      foundationSubtitle: 'የምናደርገው ነገር ሁሉ በእነዚህ መሠረታዊ የላቀ ውጤት እና የታማኝነት ምሰሶዎች ላይ የተገነባ ነው።',
      missionTitle: 'ተልእኳችን',
      missionDesc: 'ተማሪዎችን በዓለም አቀፍ ማህበረሰብ ውስጥ ስኬታማ እንዲሆኑ እና ለማህበረሰባቸው ትርጉም ያለው አስተዋፅዖ እንዲያበረክቱ አስፈላጊውን እውቀት፣ ክህሎት እና ባህሪ ማስታጠቅ።',
      visionTitle: 'ራዕያችን',
      visionDesc: 'በእያንዳንዱ ተማሪ ውስጥ የሕይወት ዘመን ትምህርትን፣ ሂሳዊ አስተሳሰብን እና ዓለም አቀፍ ዜግነትን የሚያነሳሳ የላቀ የትምህርት ማዕከል መሆን።',
      valuesTitle: 'እሴቶቻችን',
      values: [
        { t: 'ታማኝነት', d: 'ሁልጊዜ ትክክለኛውን ነገር ማድረግ።' },
        { t: 'የላቀ ውጤት', d: 'ለከፍተኛ ደረጃዎች መጣጣር።' },
        { t: 'ክብር', d: 'ለእያንዳንዱ ግለሰብ ዋጋ መስጠት።' }
      ],
      leadershipBadge: 'አመራራችን',
      leadershipTitle: 'ለስኬታችን በስተጀርባ ያሉ አእምሮዎች።',
      leadershipSubtitle: 'የአመራር ቡድናችን የአስርተ ዓመታት ልምድ እና ለለውጥ ትምህርት የጋራ ፍላጎት አለው።',
      viewAllFaculty: 'ሁሉንም መምህራን ይመልከቱ',
      accreditationBadge: 'እውቅና እና ደረጃዎች',
      accreditationTitle: 'ለጥራት እውቅና የተሰጠው።',
      accreditationDesc: 'አቡነ ጎርጎርዮስ ትምህርት ቤት በትምህርት ሚኒስቴር ሙሉ እውቅና የተሰጠው ሲሆን ሁሉንም ብሄራዊ የትምህርት ጥራት ደረጃዎችን ያሟላል። እንዲሁም የበርካታ ዓለም አቀፍ የትምህርት ማህበራት አባል በመሆናችን እንኮራለን።',
      journeyBadge: 'የእኛ ጉዞ',
      journeyTitle: 'የሦስት አስርት ዓመታት እድገት።',
      journeyDesc: 'ከትሁት ጅማሮአችን ጀምሮ እስከ አሁኑ መሪ የትምህርት ተቋም ደረጃችን ድረስ፣ የእያንዳንዱ የጉዞአችን እርምጃ ለላቀ ውጤት ባለን ቁርጠኝነት የተመራ ነው።'
    },
    dashboard: {
      welcome: 'እንኳን ደህና መጡ',
      studentId: 'የተማሪ መታወቂያ',
      employeeId: 'የሰራተኛ መታወቂያ',
      grade: 'ክፍል',
      enrolled: 'የተመዘገበበት',
      joined: 'የተቀላቀለበት',
      editProfile: 'ፕሮፋይል ያስተካክሉ',
      quickResources: 'ፈጣን መርጃዎች',
      upcomingClasses: 'የሚቀጥሉ ክፍሎች',
      directorTools: 'የዳይሬክተር መሣሪያዎች',
      systemMessages: 'የስርዓት መልዕክቶች',
      new: 'አዲስ',
      noMessages: 'አዲስ መልዕክት የለም',
      directorTitle: 'የትምህርት ቤቱ ዳይሬክተር',
      createPost: 'ልጥፍ ፍጠር',
      recentBlog: 'የቅርብ ጊዜ የብሎግ ልጥፎች',
      schoolNews: 'የትምህርት ቤት ዜናዎች እና ማስታወቂያዎች',
      viewAll: 'ሁሉንም ይመልከቱ',
      studentManagement: 'የተማሪዎች አስተዳደር',
      studentManagementDesc: 'የተማሪ ፕሮፋይሎችን ይመልከቱ እና ያስተዳድሩ',
      addStudent: 'ተማሪ ጨምር',
      tableStudent: 'ተማሪ',
      tableGrade: 'ክፍል',
      tableId: 'የተማሪ መታወቂያ',
      tableActions: 'ተግባራት',
      totalStudents: 'ጠቅላላ ተማሪዎች',
      staffMembers: 'የሰራተኞች ብዛት',
      activeEvents: 'ንቁ ክስተቶች',
      searchPlaceholder: 'በስም፣ በመታወቂያ ወይም በኢሜይል ይፈልጉ...',
      filterAll: 'ሁሉም ክፍሎች',
      noStudents: 'ከእርስዎ ፍለጋ ጋር የሚዛመድ ተማሪ አልተገኘም።',
      sortLabel: 'ተማሪዎችን ደርድር',
      sortAsc: 'መታወቂያ፡ ከትንሽ ወደ ትልቅ',
      sortDesc: 'መታወቂያ፡ ከትልቅ ወደ ትንሽ',
      sortGradeAsc: 'ክፍል፡ ከትንሽ ወደ ትልቅ',
      sortGradeDesc: 'ክፍል፡ ከትልቅ ወደ ትንሽ',
      photoUrl: 'የፕሮፋይል ፎቶ URL',
      generateAI: 'በAI ፍጠር',
      sendMessage: 'መልዕክት ላክ',
      messages: 'መልዕክቶች',
      messagePlaceholder: 'መልዕክትዎን እዚህ ይጻፉ...',
      categoryAcademic: 'ትምህርታዊ',
      categoryBehavior: 'ባህሪ',
      categoryGeneral: 'አጠቃላይ',
      categoryUrgent: 'አስቸኳይ',
      noStudentMessages: 'ምንም መልዕክት የለም።',
      fromDirector: 'ከዳይሬክተሩ',
      myEvents: 'የተመዘገብኩባቸው ኩነቶች',
      noRegisteredEvents: 'እስካሁን ለምንም ኩነት አልተመዘገቡም።',
      currentGrades: 'የአሁኑ ውጤቶች',
      upcomingAssignments: 'የሚቀጥሉ ተግባራት',
      subject: 'ትምህርት',
      status: 'ሁኔታ',
      dueDate: 'የማስረከቢያ ቀን',
      math: 'ሂሳብ',
      physics: 'ፊዚክስ',
      history: 'ታሪክ',
      english: 'እንግሊዝኛ',
      biology: 'ባዮሎጂ',
      chemistry: 'ኬሚስትሪ',
      gradebook: 'የውጤት መዝገብ',
      assignmentStatus: 'የተግባራት ሁኔታ',
      overallGrade: 'አጠቃላይ ውጤት',
      attendance: 'መገኘት',
      gpa: 'አማካይ ውጤት',
      assignments: 'ተግባራት',
      score: 'ውጤት',
      total: 'ከ',
      date: 'ቀን',
      viewAssignments: 'ተግባራትን ይመልከቱ',
      postGrade: 'ውጤት መዝግብ',
      selectSubject: 'ትምህርት ምረጥ',
      selectAssignment: 'ተግባር ምረጥ',
      enterGrade: 'ውጤት አስገባ (ለምሳሌ A, B+)',
      enterAttendance: 'የመገኘት %',
      enterStatus: 'ሁኔታ (ለምሳሌ በጥሩ ሁኔታ ላይ)',
      gradePosted: 'ውጤቱ በተሳካ ሁኔታ ተመዝግቧል!',
      addNewAssignment: 'አዲስ ተግባር ጨምር',
      assignmentTitle: 'የተግባር ርዕስ',
      manageCalendar: 'የትምህርት ካላንደር አስተዳድር',
      manageCalendarDesc: 'አስፈላጊ የትምህርት ቤት ቀናትን እና ኩነቶችን ይጨምሩ፣ ያስተካክሉ እና ይመልከቱ።',
      addEvent: 'ኩነት ጨምር',
      editEvent: 'ኩነት ያስተካክሉ',
      eventTitle: 'የኩነቱ ርዕስ',
      eventDate: 'የኩነቱ ቀን',
      eventTime: 'ሰዓት',
      eventLocation: 'ቦታ',
      eventType: 'የኩነቱ አይነት',
      eventDescription: 'መግለጫ',
      holiday: 'በዓል',
      exam: 'የፈተና ወቅት',
      schoolEvent: 'የትምህርት ቤት ኩነት',
      saveEvent: 'ኩነቱን አስቀምጥ',
      deleteEvent: 'ኩነቱን ሰርዝ',
    },
    onboarding: {
      title: 'ወደ ትምህርት ቤታችን እንኳን ደህና መጡ!',
      subtitle: 'እባክዎ ለመጀመር ፕሮፋይልዎን ያጠናቅቁ።',
      fullName: 'ሙሉ ስም',
      photoUrl: 'የፕሮፋይል ፎቶ URL',
      placeholderName: 'ሙሉ ስምዎን ያስገቡ',
      placeholderPhoto: 'https://example.com/photo.jpg',
      submit: 'ፕሮፋይል ያጠናቅቁ'
    },
    faculty: [
      { name: "ዶ/ር አብርሃም ተክሌ", title: "የትምህርት ቤቱ ዳይሬክተር", photo: "https://storage.googleapis.com/static.antigravity.ai/user_uploads/67e3d644-889a-487f-9988-660990477619/image.png", bio: "ዶ/ር አብርሃም በትምህርት አመራር ከ20 ዓመታት በላይ ልምድ አላቸው። እያንዳንዱ ተማሪ በትምህርት ጥራት እና በባህሪ ግንባታ ሙሉ አቅሙን እንዲያሳካ ምቹ ሁኔታ ለመፍጠር ቁርጠኛ ናቸው።" },
      { name: "ወ/ሮ ማርታ ገብሬ", title: "የትምህርት ክፍል ኃላፊ", bio: "ወ/ሮ ማርታ የስርአተ ትምህርት ዝግጅታችንን እና የመምህራን ስልጠናችንን ይከታተላሉ። ጠንካራ ትምህርትን ከፈጠራ ችሎታ ጋር የሚያመጣጥን ሁሉን አቀፍ የትምህርት አቀራረብ ያምናሉ።" },
      { name: "አቶ ሳሙኤል በቀለ", title: "ከፍተኛ የሂሳብ መምህር", bio: "ለቁጥሮች ባላቸው ፍቅር፣ አቶ ሳሙኤል ውስብስብ የሂሳብ ፅንሰ-ሀሳቦችን ለሁሉም ደረጃ ተማሪዎች ተደራሽ እና አስደሳች ያደርጋሉ።" },
      { name: "ወ/ሮ ሄለን ታደሰ", title: "የሳይንስ ትምህርት ክፍል ኃላፊ", bio: "ወ/ሮ ሄለን በተግባራዊ ሙከራዎች እና በጥናት ላይ የተመሰረተ ትምህርት ሳይንስን ህያው ያደርጋሉ፣ ተማሪዎች የተፈጥሮን ድንቆች እንዲመረምሩ ያበረታታሉ።" },
      { name: "አቶ ዳዊት ግርማ", title: "ታሪክ እና ማህበራዊ ጥናቶች", bio: "አቶ ዳዊት ተማሪዎች የወደፊት ህይወታቸውን በተሻለ ሁኔታ እንዲመሩ ያለፈውን ጊዜ እንዲረዱ በመርዳት ረገድ ከፍተኛ ፍላጎት አላቸው። ክፍሎቻቸው በደመቀ ውይይት እና በሂሳዊ አስተሳሰብ ይታወቃሉ።" },
      { name: "ወ/ሪት ሳራ ዮሴፍ", title: "የእንግሊዝኛ ቋንቋ ባለሙያ", bio: "ወ/ሪት ሳራ በተማሪዎቻቸው ውስጥ ጠንካራ የመግባቢያ ክህሎቶችን እና ለሥነ-ጽሑፍ ፍቅርን በማዳበር ላይ ያተኩራሉ፣ ይህም በዓለም አቀፍ ደረጃ ለስኬት ያዘጋጃቸዋል።" },
      { name: "አቶ ካሳሁን ጥላሁን", title: "የ8ኛ ክፍል ማህበራዊ ጥናት መምህር", bio: "አቶ ካሳሁን ለ8ኛ ክፍል ተማሪዎቻችን ስለ ማህበረሰባችን እና እድገቱ ጥልቅ ግንዛቤ በመስጠት ታሪክን እና ጂኦግራፊን ህያው ያደርጋሉ።" },
      { name: "ወ/ሪት ትዕግስት አለሙ", title: "የ8ኛ ክፍል ጠቅላላ ሳይንስ መምህር", bio: "ወ/ሪት ትዕግስት ለሳይንስ እና ቴክኖሎጂ ከፍተኛ ፍላጎት አላቸው፣ የ8ኛ ክፍል ተማሪዎችን በተግባራዊ ሙከራዎች በአስደናቂው የሳይንስ ዓለም ውስጥ ይመራሉ።" },
      { name: "አቶ ቶሎሳ ገመቹ", title: "የአፋን ኦሮሞ መምህር", bio: "አቶ ቶሎሳ የአፋን ኦሮሞ ቋንቋን እና ባህልን በማስተማር፣ ተማሪዎች ጠንካራ የቋንቋ ክህሎት እና የባህል አድናቆት እንዲያዳብሩ በመርዳት ላይ ያተኩራሉ።" }
    ],
    events: [
      { title: "ዓመታዊ የሳይንስ ትርኢት", location: "የትምህርት ቤቱ ዋና አዳራሽ", description: "ከሁሉም ክፍሎች የተውጣጡ ተማሪዎች የፈጠራ የሳይንስ ፕሮጀክቶቻቸውን እና ሙከራዎቻቸውን ያቀርባሉ። ወላጆች እና የማህበረሰቡ አባላት እንዲገኙ ተጋብዘዋል።", category: "Academic" },
      { title: "የትምህርት ቤቶች የእግር ኳስ ፍፃሜ", location: "የትምህርት ቤቱ ስፖርት ሜዳ", description: "የትምህርት ቤታችን ቡድን በክልል ፍፃሜ ሲወዳደር ደግፉ። የደስታ እና የትምህርት ቤት መንፈስ ቀን!", category: "Sports" },
      { title: "የወላጅ እና መምህራን ስብሰባ", location: "በየክፍሉ", description: "ወላጆች ስለ ልጃቸው የትምህርት እድገት እና ሁኔታ ከመምህራን ጋር የሚወያዩበት አጋጣሚ።", category: "Academic" },
      { title: "የባህል ቀን አከባበር", location: "የትምህርት ቤቱ ግቢ", description: "የማህበረሰባችንን ብዝሃነት በተለያዩ ባህላዊ ሙዚቃዎች፣ ጭፈራዎች እና ምግቦች ማክበር።", category: "Social" },
      { title: "የትንሳኤ በዓል እረፍት", location: "መላው ግቢ", description: "ትምህርት ቤቱ ለትንሳኤ በዓል ዝግ ይሆናል። ትምህርት በሚቀጥለው ሰኞ ይቀጥላል።", category: "Holiday" }
    ],
    eventModal: {
      closeDetails: 'ዝርዝሩን ዝጋ',
      register: 'ምዝገባውን አረጋግጥ',
      unregister: 'ምዝገባን ሰርዝ',
      success: 'ምዝገባው ተረጋግጧል!',
      successMsg: 'ለዚህ ኩነት ተመዝግበዋል።',
      alreadyRegistered: 'ቀደም ሲል ለዚህ ኩነት ተመዝግበዋል።',
      registeredStudents: 'የተመዘገቡ ተማሪዎች'
    },
    gallery: [
      { title: 'ዘመናዊ የሳይንስ ላብራቶሪ', category: 'Facility' },
      { title: 'የተማሪዎች የቅርጫት ኳስ ግጥሚያ', category: 'Activity' },
      { title: 'ሰፊ ቤተ-መጻሕፍት', category: 'Facility' },
      { title: 'የጥበብ አውደ ጥናት', category: 'Activity' },
      { title: 'የኮምፒውተር ላብራቶሪ', category: 'Facility' },
      { title: 'የውጪ ንባብ ቦታ', category: 'Facility' },
      { title: 'የቡድን ጥናት ክፍለ ጊዜ', category: 'Activity' },
      { title: 'የትምህርት ቤቱ እግር ኳስ ሜዳ', category: 'Facility' }
    ],
    blog: [
      { title: 'ወደ አዲሱ ድረ-ገጻችን እንኳን ደህና መጡ', content: 'አዲሱን ዲጂታል ቤታችንን በማስጀመራችን ደስተኞች ነን። ይህ መድረክ ለሁሉም የትምህርት ቤት እንቅስቃሴዎቻችን፣ ዜናዎች እና የትምህርት ግብአቶች ማዕከል ሆኖ ያገለግላል። ለተከታታይ ዝመናዎች ይጠብቁ!' },
      { title: 'የትምህርት የላቀ ውጤት ሽልማቶች', content: 'በዚህ ሴሚስተር ሽልማት ላገኙ ተማሪዎቻችን ሁሉ እንኳን ደስ አላችሁ። የእናንተ ጠንካራ ስራ እና ትጋት ሁላችንንም ማነሳሳቱን ቀጥሏል።' }
    ],
    news: [
      { title: 'ትምህርት ቤት የሚከፈትበት ቀን', content: '3ኛው መንፈቅ ዓመት በሚያዝያ 7 ቀን ይጀምራል። ሁሉንም ተማሪዎች ለሌላ ውጤታማ የትምህርት ዘመን ለመቀበል በጉጉት እንጠብቃለን።' },
      { title: 'አዲስ የሳይንስ ላብራቶሪ ዕቃዎች', content: 'ለላቦራቶሪዎቻችን ዘመናዊ መሣሪያዎችን ተቀብለናል፣ ይህም ለሳይንስ ተማሪዎች የተግባር ትምህርት ልምዳችንን ያሳድጋል።' }
    ],
    contactPage: {
      heroTitle: 'ያግኙን።',
      heroSubtitle: 'ጥያቄዎች አሉዎት? እኛ ለመርዳት እዚህ ነን። ከታች ባሉት ማናቸውም መንገዶች ያግኙን ወይም በቀጥታ መልዕክት ይላኩልን።',
      infoTitle: 'የእውቂያ መረጃ',
      infoSubtitle: 'በትምህርት ቤታችን ግቢ ያግኙን ወይም በስልክ ወይም በኢሜይል ያነጋግሩን።',
      formTitle: 'መልዕክት ይላኩልን',
      formSubtitle: 'ከታች ያለውን ቅጽ ይሙሉ እና ቡድናችን በተቻለ ፍጥነት ምላሽ ይሰጥዎታል።',
      nameLabel: 'ሙሉ ስም',
      emailLabel: 'ኢሜይል አድራሻ',
      subjectLabel: 'ርዕሰ ጉዳይ',
      messageLabel: 'የእርስዎ መልዕክት',
      submitButton: 'መልዕክት ላክ',
      successTitle: 'መልዕክቱ ተልኳል!',
      successMessage: 'ስላነጋገሩን እናመሰግናለን። መልዕክትዎ ደርሶናል እና በቅርቡ ምላሽ እንሰጥዎታለን።',
      addressTitle: 'የእኛ ቦታ',
      phoneTitle: 'ስልክ ቁጥር',
      emailTitle: 'ኢሜይል አድራሻ',
      hoursTitle: 'የስራ ሰዓት',
      addressValue: 'ቦሌ ክፍለ ከተማ፣ አዲስ አበባ፣ ኢትዮጵያ',
      phoneValue: '+251 11 123 4567',
      emailValue: 'info@abunegorgorios.edu.et',
      hoursValue: 'ሰኞ - አርብ፡ ከጠዋቱ 2፡00 - 11፡00 ሰዓት',
      supportTitle: 'የአይቲ ድጋፍ',
      supportDesc: 'ከፖርታሉ ጋር በተያያዘ ለቴክኒክ ችግሮች እባክዎን የድጋፍ ቡድናችንን ያነጋግሩ።'
    },
    footer: {
      about: 'ስለ እኛ',
      quickLinks: 'ፈጣን ሊንኮች',
      contact: 'ያግኙን',
      rights: 'መብቱ በህግ የተጠበቀ ነው።'
    },
    payment: {
      title: 'የመስመር ላይ ክፍያ',
      subtitle: 'የትምህርት ቤት ክፍያዎን በመስመር ላይ ደህንነቱ በተጠበቀ ሁኔታ ይክፈሉ።',
      accountInfo: 'የትምህርት ቤት አካውንት መረጃ',
      bankName: 'የኢትዮጵያ ንግድ ባንክ (CBE)',
      accountNumber: 'የአካውንት ቁጥር: 1000123456789',
      accountHolder: 'የአካውንት ባለቤት: አቡነ ጎርጎርዮስ ትምህርት ቤት',
      tuitionFee: 'የትምህርት ክፍያ',
      registrationFee: 'የምዝገባ ክፍያ',
      totalAmount: 'ጠቅላላ መጠን',
      paymentInstructions: 'እባክዎን በክፍያ መግለጫው ውስጥ የተማሪውን መታወቂያ ያካትቱ። ከከከፈሉ በኋላ ደረሰኝዎን በዳሽቦርዱ ውስጥ ይስቀሉ።',
      payNow: 'አሁን ይክፈሉ',
      uploadReceipt: 'ደረሰኝ ይስቀሉ',
      price: 'ዋጋ',
      currency: 'ብር'
    }
  }
};
import { 
  Menu, 
  X, 
  ChevronRight, 
  ChevronDown,
  Globe,
  Mail,
  Phone,
  MapPin,
  Send,
  Search,
  User,
  UserPlus,
  CheckCircle,
  CheckCircle2,
  LifeBuoy,
  GraduationCap,
  ClipboardList,
  Lock,
  LogOut,
  BookOpen,
  Calendar,
  Calendar as CalendarIcon,
  Bell,
  Camera,
  LayoutGrid,
  List,
  Maximize2,
  Download,
  FileText,
  Clock,
  Award,
  Shield,
  Target,
  Users,
  Quote,
  Plus,
  Trash2,
  Edit3,
  Newspaper,
  Eye,
  Filter,
  ChevronLeft,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  AlertCircle,
  Settings,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Check,
  XCircle,
  Printer,
  Contact,
  CreditCard,
  Building2,
  Hash,
  Info,
  WifiOff,
  Chrome,
  RefreshCw,
} from 'lucide-react';

type Page = 'Home' | 'About' | 'Admissions' | 'Academics' | 'Faculty' | 'Blog' | 'Events' | 'Contact' | 'Dashboard';

interface FacultyMember {
  id: number;
  teacherId: string;
  name: string;
  title: string;
  photo: string;
  bio: string;
}

const facultyMembers: FacultyMember[] = [
  {
    id: 1,
    teacherId: "T-001",
    name: "Dr. Abraham Tekle",
    title: "School Director",
    photo: "https://storage.googleapis.com/static.antigravity.ai/user_uploads/67e3d644-889a-487f-9988-660990477619/image.png",
    bio: "Dr. Abraham has over 20 years of experience in educational leadership. He is dedicated to fostering an environment where every student can achieve their full potential through academic excellence and character development."
  },
  {
    id: 2,
    teacherId: "T-002",
    name: "Ms. Martha Gebre",
    title: "Head of Academics",
    photo: "https://picsum.photos/seed/faculty2/400/500",
    bio: "Ms. Martha oversees our curriculum development and teacher training. She believes in a holistic approach to education that balances rigorous academics with creative expression."
  },
  {
    id: 3,
    teacherId: "T-003",
    name: "Mr. Samuel Bekele",
    title: "Senior Mathematics Teacher",
    photo: "https://picsum.photos/seed/faculty3/400/500",
    bio: "With a passion for numbers, Mr. Samuel makes complex mathematical concepts accessible and exciting for students of all levels."
  },
  {
    id: 4,
    teacherId: "T-004",
    name: "Mrs. Helen Tadesse",
    title: "Science Department Head",
    photo: "https://picsum.photos/seed/faculty4/400/500",
    bio: "Mrs. Helen brings science to life through hands-on experiments and inquiry-based learning, encouraging students to explore the wonders of the natural world."
  },
  {
    id: 5,
    teacherId: "T-005",
    name: "Mr. Dawit Girma",
    title: "History & Social Studies",
    photo: "https://picsum.photos/seed/faculty5/400/500",
    bio: "Mr. Dawit is passionate about helping students understand the past to better navigate the future. His classes are known for lively discussions and critical thinking."
  },
  {
    id: 6,
    teacherId: "T-006",
    name: "Ms. Sara Yosef",
    title: "English Language Specialist",
    photo: "https://picsum.photos/seed/faculty6/400/500",
    bio: "Ms. Sara focuses on developing strong communication skills and a love for literature in her students, preparing them for success in a globalized world."
  }
];

interface SchoolEvent {
  id: number;
  title: string;
  date: string; // ISO format YYYY-MM-DD
  time: string;
  location: string;
  description: string;
  category: 'Academic' | 'Social' | 'Sports' | 'Holiday';
}

interface Student {
  id: string;
  name: string;
  grade: string;
  email: string;
  photo: string;
  enrollmentDate: string;
  password?: string;
  hasIdCard?: boolean;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  photo: string;
  password?: string;
  uid?: string;
}

interface TeacherMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'teacher' | 'director';
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  category?: 'Academic' | 'Behavior' | 'General' | 'Urgent';
  date?: string;
}

interface GradeEntry {
  subject: string;
  grade: string;
  status: string;
  attendance: string;
  color: string;
  assignments?: Assignment[];
  assignmentCount?: number;
}

interface Assignment {
  id: number;
  title: string;
  score: number;
  total: number;
  status: 'Completed' | 'Pending' | 'Graded';
  date: string;
}

interface StudentMessage {
  id: number;
  studentId: string;
  from: string;
  content: string;
  date: string;
  category: 'Academic' | 'Behavior' | 'General' | 'Urgent';
}

interface GalleryImage {
  id: number;
  url: string;
  title: string;
  category: 'Facility' | 'Activity';
}

const galleryImages: GalleryImage[] = [
  { id: 1, url: 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?q=80&w=2070&auto=format&fit=crop', title: 'Modern Science Lab', category: 'Facility' },
  { id: 2, url: 'https://images.unsplash.com/photo-1577891729319-f69bc4313bb5?q=80&w=2070&auto=format&fit=crop', title: 'Student Basketball Match', category: 'Activity' },
  { id: 3, url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2104&auto=format&fit=crop', title: 'Spacious Library', category: 'Facility' },
  { id: 4, url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop', title: 'Art Workshop', category: 'Activity' },
  { id: 5, url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop', title: 'Computer Laboratory', category: 'Facility' },
  { id: 6, url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop', title: 'Outdoor Reading Area', category: 'Facility' },
  { id: 7, url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop', title: 'Group Study Session', category: 'Activity' },
  { id: 8, url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=2069&auto=format&fit=crop', title: 'School Football Field', category: 'Facility' },
];

const schoolEvents: SchoolEvent[] = [
  {
    id: 1,
    title: "Annual Science Fair",
    date: "2026-03-25",
    time: "09:00 AM - 03:00 PM",
    location: "School Main Hall",
    description: "Students from all grades showcase their innovative science projects and experiments. Parents and community members are welcome to attend.",
    category: "Academic"
  },
  {
    id: 2,
    title: "Inter-School Soccer Finals",
    date: "2026-03-28",
    time: "02:00 PM - 05:00 PM",
    location: "School Sports Ground",
    description: "Cheer for our school team as they compete in the regional finals. A day of excitement and school spirit!",
    category: "Sports"
  },
  {
    id: 3,
    title: "Parent-Teacher Conference",
    date: "2026-04-05",
    time: "08:30 AM - 04:30 PM",
    location: "Respective Classrooms",
    description: "An opportunity for parents to discuss their child's academic progress and development with teachers.",
    category: "Academic"
  },
  {
    id: 4,
    title: "Cultural Day Celebration",
    date: "2026-04-12",
    time: "10:00 AM - 06:00 PM",
    location: "School Courtyard",
    description: "Celebrating the rich diversity of our community through traditional music, dance, and food from various cultures.",
    category: "Social"
  },
  {
    id: 5,
    title: "Easter Holiday Break",
    date: "2026-04-17",
    time: "All Day",
    location: "Campus Wide",
    description: "School will be closed for the Easter holiday break. Classes will resume on the following Monday.",
    category: "Holiday"
  }
];

const StudentIDCard = ({ student, onClose, onIssue, isDirector, lang }: { student: Student, onClose: () => void, onIssue?: () => void, isDirector: boolean, lang: string }) => {
  const [isIssuing, setIsIssuing] = useState(false);

  const handleIssue = async () => {
    if (!onIssue) return;
    setIsIssuing(true);
    await onIssue();
    setIsIssuing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ID Card Design */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
              <img 
                src="https://storage.googleapis.com/static.antigravity.dev/gemini-3-flash-preview/2026-03-20/abebeeyob64@gmail.com/1742461437146.png" 
                alt="Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Abune Gorgorios</h2>
              <p className="text-xs text-blue-100 font-medium tracking-wider uppercase">School Student ID</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold mb-1">{student.name}</h3>
              <p className="text-blue-100 font-medium">{student.grade}</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-white">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{lang === 'en' ? 'Student ID' : 'የተማሪ መታወቂያ'}</p>
              <p className="font-mono font-bold text-slate-700">{student.id}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{lang === 'en' ? 'Issue Date' : 'የተሰጠበት ቀን'}</p>
              <p className="font-bold text-slate-700">{student.enrollmentDate}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{lang === 'en' ? 'Email Address' : 'የኢሜል አድራሻ'}</p>
              <p className="font-bold text-slate-700">{student.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {isDirector && !student.hasIdCard && (
              <button 
                onClick={handleIssue}
                disabled={isIssuing}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isIssuing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {isIssuing 
                  ? (lang === 'en' ? 'Issuing...' : 'በመስጠት ላይ...') 
                  : (lang === 'en' ? 'Issue & Send ID Card' : 'መታወቂያውን ስጥ እና ላክ')}
              </button>
            )}
            
            <button 
              onClick={() => window.print()}
              className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" /> {lang === 'en' ? 'Print ID Card' : 'መታወቂያውን አትም'}
            </button>
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-400 font-medium">
            {lang === 'en' 
              ? 'This ID card is the property of Abune Gorgorios School. If found, please return to the school office.' 
              : 'ይህ መታወቂያ የአቡነ ጎርጎርዮስ ትምህርት ቤት ንብረት ነው። ቢገኝ እባክዎን ለትምህርት ቤቱ ቢሮ ይመልሱ።'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [selectedContent, setSelectedContent] = useState<{ title: string; content: string; date?: string; image?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSimulatedSession, setIsSimulatedSession] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Test Firestore connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'config', 'connection-test'));
        console.log("Firestore connection successful");
        setConnectionError(null);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
          setConnectionError("Could not reach Cloud Firestore backend. Please check your internet connection or Firebase configuration.");
        } else {
          // Skip logging for other errors during initial test, as the document might not exist
          console.log("Firestore test connection check completed (document may not exist, which is fine)");
        }
      }
    }
    testConnection();
  }, []);

  const t = translations[lang];

  const facultyMembers: FacultyMember[] = t.faculty.map((f: any, i) => ({
    ...f,
    id: i + 1,
    teacherId: `T-${String(i + 1).padStart(3, '0')}`,
    photo: f.photo || `https://picsum.photos/seed/faculty${i + 1}/400/500`
  }));

  const schoolEvents: SchoolEvent[] = [
    { id: 1, ...t.events[0], date: "2026-03-25", time: "09:00 AM - 03:00 PM" },
    { id: 2, ...t.events[1], date: "2026-03-28", time: "02:00 PM - 05:00 PM" },
    { id: 3, ...t.events[2], date: "2026-04-05", time: "08:30 AM - 04:30 PM" },
    { id: 4, ...t.events[3], date: "2026-04-12", time: "10:00 AM - 06:00 PM" },
    { id: 5, ...t.events[4], date: "2026-04-17", time: "All Day" }
  ];

  const galleryImages: GalleryImage[] = t.gallery.map((g, i) => ({
    ...g,
    id: i + 1,
    url: [
      'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1577891729319-f69bc4313bb5?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2104&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=2069&auto=format&fit=crop',
    ][i],
    category: g.category as any
  }));

  const [activePage, setActivePage] = useState<Page>('Home');
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2)); // March 2026
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loginType, setLoginType] = useState<'student' | 'teacher' | 'director'>('student');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isViewingIdCard, setIsViewingIdCard] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingIdCard, setViewingIdCard] = useState<Student | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [userRole, setUserRole] = useState<'Student' | 'Director' | 'Teacher' | null>(null);
  const [userData, setUserData] = useState({ 
    name: '', 
    grade: '', 
    id: '',
    studentId: '',
    teacherId: '',
    photo: '',
    email: '',
    enrollmentDate: '',
    title: '',
    hasIdCard: false,
    subject: ''
  });

  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [admissionReply, setAdmissionReply] = useState('');
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentIdSearchQuery, setStudentIdSearchQuery] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('All');
  const [studentPage, setStudentPage] = useState(1);
  const studentsPerPage = 6;
  const [studentSortOrder, setStudentSortOrder] = useState<'Asc' | 'Desc' | 'GradeAsc' | 'GradeDesc'>('Asc');
  const [isPosting, setIsPosting] = useState(false);
  const [isManagingCalendar, setIsManagingCalendar] = useState(false);
  const [studentViewMode, setStudentViewMode] = useState<'grid' | 'table'>('grid');
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [newEventForm, setNewEventForm] = useState({ 
    title: '', 
    date: '', 
    time: '', 
    location: '', 
    description: '', 
    category: 'Academic' as 'Academic' | 'Social' | 'Sports' | 'Holiday' 
  });
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [isEditingFaculty, setIsEditingFaculty] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<FacultyMember | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', email: '', photo: '', id: '', password: '' });
  const [newFaculty, setNewFaculty] = useState({ name: '', title: '', bio: '', photo: '', teacherId: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  };

  const passwordStrength = getPasswordStrength(loginPassword);

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0: return 'bg-slate-200';
      case 1: return 'bg-red-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-green-500';
      default: return 'bg-slate-200';
    }
  };

  const getStrengthText = (score: number) => {
    if (!loginPassword) return '';
    switch (score) {
      case 1: return lang === 'en' ? 'Weak' : 'ደካማ';
      case 2: return lang === 'en' ? 'Fair' : 'መካከለኛ';
      case 3: return lang === 'en' ? 'Good' : 'ጥሩ';
      case 4: return lang === 'en' ? 'Strong' : 'በጣም ጥሩ';
      default: return '';
    }
  };
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isNewStudentOnboarding, setIsNewStudentOnboarding] = useState(false);
  const [directorMessages, setDirectorMessages] = useState<{ id: number; from: string; content: string; date: string }[]>([]);
  const [studentMessages, setStudentMessages] = useState<StudentMessage[]>([]);
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [studentGrades, setStudentGrades] = useState<Record<string, GradeEntry[]>>({});
  const [selectedSubject, setSelectedSubject] = useState<GradeEntry | null>(null);
  const [viewingStudentGrades, setViewingStudentGrades] = useState<string | null>(null);
  const [selectedPerformanceSubject, setSelectedPerformanceSubject] = useState<string | null>(null);
  const [isPostingGrade, setIsPostingGrade] = useState(false);
  const [postingGradeStudent, setPostingGradeStudent] = useState<Student | null>(null);
  const [newGradeForm, setNewGradeForm] = useState({ 
    subject: '', 
    assignmentId: '', 
    assignmentTitle: '',
    score: '', 
    total: '', 
    grade: '', 
    status: '', 
    attendance: '' 
  });
  const [gradePostSuccess, setGradePostSuccess] = useState(false);
  const [isMessagingStudent, setIsMessagingStudent] = useState(false);
  const [messagingStudent, setMessagingStudent] = useState<Student | null>(null);
  const [isMessagingFaculty, setIsMessagingFaculty] = useState(false);
  const [messagingFaculty, setMessagingFaculty] = useState<FacultyMember | null>(null);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [newMessageCategory, setNewMessageCategory] = useState<'Academic' | 'Behavior' | 'General' | 'Urgent'>('General');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [admissionForm, setAdmissionForm] = useState({
    studentName: '',
    grade: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    previousSchool: '',
    lastGrade: ''
  });
  const [registeredEventIds, setRegisteredEventIds] = useState<number[]>([]);
  const [isFetchingRegistrations, setIsFetchingRegistrations] = useState(false);

  useEffect(() => {
    if (isLoggedIn && userData?.uid) {
      const fetchRegistrations = async () => {
        setIsFetchingRegistrations(true);
        try {
          const q = query(collection(db, 'registrations'), where('userId', '==', userData.uid));
          const snapshot = await getDocs(q);
          const ids = snapshot.docs.map(doc => doc.data().eventId as number);
          setRegisteredEventIds(ids);
        } catch (error) {
          console.error('Error fetching registrations:', error);
        } finally {
          setIsFetchingRegistrations(false);
        }
      };
      fetchRegistrations();
    } else {
      setRegisteredEventIds([]);
    }
  }, [isLoggedIn, userData?.uid]);
  const [dashboardTab, setDashboardTab] = useState<string>('Overview');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: '', grade: '', photo: '' });
  const [postType, setPostType] = useState<'Blog' | 'News' | 'Event'>('Blog');
  const [newPost, setNewPost] = useState({ title: '', content: '', date: '', time: '', location: '', category: 'Academic' as any, image: '' });
  const [galleryFilter, setGalleryFilter] = useState<'All' | 'Facility' | 'Activity'>('All');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const [eventCategoryFilter, setEventCategoryFilter] = useState<'All' | 'Academic' | 'Social' | 'Sports' | 'Holiday'>('All');
  const [viewingGradeHistory, setViewingGradeHistory] = useState<Student | null>(null);
  const [currentStudentAssignments, setCurrentStudentAssignments] = useState<Record<string, Assignment[]>>({});
  const [gradeHistoryView, setGradeHistoryView] = useState<'BySubject' | 'AllAssignments'>('BySubject');
  const [gradebookSubTab, setGradebookSubTab] = useState<'Students' | 'Assignments' | 'Attendance'>('Students');
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [newAssignmentForm, setNewAssignmentForm] = useState({ title: '', subject: '', total: '', date: new Date().toISOString().split('T')[0] });
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [studentPaymentSearch, setStudentPaymentSearch] = useState('');
  const [foundStudentForPayment, setFoundStudentForPayment] = useState<Student | null>(null);
  const [studentPayments, setStudentPayments] = useState<any[]>([]);
  const [isViewingPayments, setIsViewingPayments] = useState(false);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<Student | null>(null);
  const [isIssuingReceipt, setIsIssuingReceipt] = useState(false);
  const [newReceipt, setNewReceipt] = useState({ amount: '', date: new Date().toISOString().split('T')[0], description: 'Tuition Fee' });
  const [isViewingReceipts, setIsViewingReceipts] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isAddingTeacherAccount, setIsAddingTeacherAccount] = useState(false);
  const [newTeacherAccount, setNewTeacherAccount] = useState({ name: '', teacherId: '', email: '', password: '', subject: '' });

  useEffect(() => {
    if (foundStudentForPayment) {
      const unsubscribe = onSnapshot(collection(db, 'students', foundStudentForPayment.id, 'payments'), (snapshot) => {
        setStudentPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    } else {
      setStudentPayments([]);
    }
  }, [foundStudentForPayment]);

  useEffect(() => {
    if (userData.role === 'Student' && userData.id) {
      const unsubscribe = onSnapshot(collection(db, 'students', userData.id, 'receipts'), (snapshot) => {
        setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [userData]);
  useEffect(() => {
    const studentId = viewingGradeHistory?.id || postingGradeStudent?.id || viewingStudentGrades || (userRole === 'Student' ? auth.currentUser?.uid : null);
    if (!studentId) {
      setCurrentStudentAssignments({});
      return;
    }

    const fetchAssignments = async () => {
      const grades = studentGrades[studentId] || [];
      const allAssignments: Record<string, Assignment[]> = {};

      for (const grade of grades) {
        const gradeDocId = grade.subject.replace(/\s+/g, '_').toLowerCase();
        const assignmentsSnapshot = await getDocs(collection(db, 'students', studentId, 'grades', gradeDocId, 'assignments'));
        const assignmentsList = assignmentsSnapshot.docs.map(doc => doc.data() as Assignment);
        
        // Merge with existing assignments in the GradeEntry (for backward compatibility)
        const existingAssignments = grade.assignments || [];
        const mergedAssignments = [...existingAssignments];
        
        assignmentsList.forEach(newA => {
          if (!mergedAssignments.find(a => a.id === newA.id)) {
            mergedAssignments.push(newA);
          }
        });

        allAssignments[grade.subject] = mergedAssignments.sort((a, b) => b.id - a.id);
      }
      setCurrentStudentAssignments(allAssignments);
    };

    fetchAssignments();
  }, [viewingGradeHistory, postingGradeStudent, viewingStudentGrades, userRole, studentGrades]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (isSimulatedSession) return;
      try {
        if (user) {
          setIsLoggedIn(true);
          setIsEmailVerified(user.emailVerified);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          const isDirector = user.email === 'abebeeyob64@gmail.com';
          
          // Check if user is a registered student or teacher if not a director
          let isRegisteredStudent = false;
          let isRegisteredTeacher = false;
          let registeredStudentData: any = null;
          let registeredTeacherData: any = null;
          
          if (!isDirector) {
            const studentQuery = query(collection(db, 'students'), where('email', '==', user.email));
            const studentSnapshot = await getDocs(studentQuery);
            if (!studentSnapshot.empty) {
              isRegisteredStudent = true;
              registeredStudentData = studentSnapshot.docs[0].data();
            } else {
              const teacherQuery = query(collection(db, 'teachers'), where('email', '==', user.email));
              const teacherSnapshot = await getDocs(teacherQuery);
              if (!teacherSnapshot.empty) {
                isRegisteredTeacher = true;
                registeredTeacherData = teacherSnapshot.docs[0].data();
              }
            }
          }

          if (!isDirector && !isRegisteredStudent && !isRegisteredTeacher) {
            await signOut(auth);
            setIsLoggedIn(false);
            setLoginError(lang === 'en' ? 'Access Denied: You are not registered. Please contact the director.' : 'መግቢያ ተከልክሏል፡ አልተመዘገቡም። እባክዎ ዳይሬክተሩን ያነጋግሩ።');
            setIsAuthReady(true);
            return;
          }

          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Strictly enforce director role only for abebeeyob64@gmail.com
            if (isDirector) {
              if (data.role !== 'director') {
                await updateDoc(userDocRef, { role: 'director' });
              }
              setUserRole('Director');
            } else {
              // If not the official director email, they cannot be a director
              const role = data.role === 'teacher' ? 'Teacher' : 'Student';
              setUserRole(role);
              
              // Downgrade if they somehow had director role in DB
              if (data.role === 'director') {
                await updateDoc(userDocRef, { role: 'student' });
              }
            }
            
            setUserData({
              name: data.name || user.displayName || '',
              email: data.email || user.email || '',
              photo: data.photoUrl || user.photoURL || '',
              id: data.studentId || data.teacherId || data.uid,
              studentId: data.studentId || '',
              teacherId: data.teacherId || '',
              grade: data.grade || (registeredStudentData?.grade) || '',
              enrollmentDate: data.enrollmentDate || (registeredStudentData?.enrollmentDate) || '',
              title: data.title || '',
              hasIdCard: data.hasIdCard || (registeredStudentData?.hasIdCard) || false,
              subject: data.subject || (registeredTeacherData?.subject) || ''
            });
          } else {
            // New user
            const role = isDirector ? 'director' : isRegisteredTeacher ? 'teacher' : 'student';
            const newUser = {
              uid: user.uid,
              name: registeredStudentData?.name || registeredTeacherData?.name || user.displayName || '',
              email: user.email || '',
              role: role,
              photoUrl: registeredStudentData?.photo || registeredTeacherData?.photo || user.photoURL || '',
              studentId: registeredStudentData?.id || '',
              teacherId: registeredTeacherData?.id || '',
              subject: registeredTeacherData?.subject || ''
            };
            await setDoc(userDocRef, newUser);
            setUserRole(role === 'director' ? 'Director' : role === 'teacher' ? 'Teacher' : 'Student');
            setUserData({
              name: newUser.name,
              email: newUser.email,
              photo: newUser.photoUrl,
              id: newUser.studentId || newUser.teacherId || newUser.uid,
              studentId: newUser.studentId,
              teacherId: newUser.teacherId,
              grade: registeredStudentData?.grade || '',
              enrollmentDate: registeredStudentData?.enrollmentDate || '',
              title: '',
              hasIdCard: registeredStudentData?.hasIdCard || false,
              subject: newUser.subject
            });
          }
        } else {
          setIsLoggedIn(false);
          setUserRole(null);
          setUserData({ name: '', grade: '', id: '', studentId: '', teacherId: '', photo: '', email: '', enrollmentDate: '', title: '', hasIdCard: false, subject: '' });
        }
      } catch (error) {
        console.error("Error during auth state change:", error);
        if (error instanceof Error && error.message.includes('permission')) {
          setLoginError("Authentication error: Missing or insufficient permissions. Please try again later.");
        }
      } finally {
        setIsAuthReady(true);
      }
    });

    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ ...doc.data() } as SchoolEvent));
      setEvents(eventsList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'events'));

    const unsubscribeBlog = onSnapshot(collection(db, 'blog'), (snapshot) => {
      const blogList = snapshot.docs.map(doc => ({ ...doc.data() } as any));
      setBlogPosts(blogList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'blog'));

    const unsubscribeNews = onSnapshot(collection(db, 'news'), (snapshot) => {
      const newsList = snapshot.docs.map(doc => ({ ...doc.data() } as any));
      setNewsItems(newsList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'news'));

    const unsubscribeFaculty = onSnapshot(collection(db, 'faculty'), (snapshot) => {
      const facultyList = snapshot.docs.map(doc => ({ ...doc.data() } as FacultyMember));
      setFaculty(facultyList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'faculty'));

    return () => {
      unsubscribeAuth();
      unsubscribeEvents();
      unsubscribeBlog();
      unsubscribeNews();
      unsubscribeFaculty();
    };
  }, [isSimulatedSession]);

  // Seed initial faculty if empty
  useEffect(() => {
    const seedFacultyIfEmpty = async () => {
      if (isLoggedIn && userRole === 'Director' && faculty.length === 0) {
        const teachers: FacultyMember[] = [
          {
            id: 101,
            teacherId: "T-101",
            name: lang === 'en' ? "Dr. Abraham Tekle" : "ዶ/ር አብርሃም ተክሌ",
            title: lang === 'en' ? "School Director" : "የትምህርት ቤቱ ዳይሬክተር",
            bio: lang === 'en' ? "Dr. Abraham has over 20 years of experience in educational leadership. He is dedicated to fostering an environment where every student can achieve their full potential through academic excellence and character development." : "ዶ/ር አብርሃም በትምህርት አመራር ከ20 ዓመታት በላይ ልምድ አላቸው። እያንዳንዱ ተማሪ በትምህርት ጥራት እና በባህሪ ግንባታ ሙሉ አቅሙን እንዲያሳካ ምቹ ሁኔታ ለመፍጠር ቁርጠኛ ናቸው።",
            photo: "https://storage.googleapis.com/static.antigravity.ai/user_uploads/67e3d644-889a-487f-9988-660990477619/image.png"
          },
          {
            id: 102,
            teacherId: "T-102",
            name: lang === 'en' ? "Ms. Tigist Alemu" : "ወ/ሪት ትዕግስት አለሙ",
            title: lang === 'en' ? "Grade 8 General Science Teacher" : "የ8ኛ ክፍል ጠቅላላ ሳይንስ መምህር",
            bio: lang === 'en' ? "Ms. Tigist is passionate about science and technology, guiding grade 8 students through the fascinating world of general science with hands-on experiments." : "ወ/ሪት ትዕግስት ለሳይንስ እና ቴክኖሎጂ ከፍተኛ ፍላጎት አላቸው፣ የ8ኛ ክፍል ተማሪዎችን በተግባራዊ ሙከራዎች በአስደናቂው የሳይንስ ዓለም ውስጥ ይመራሉ።",
            photo: "https://picsum.photos/seed/tigist/400/400"
          },
          {
            id: 103,
            teacherId: "T-103",
            name: lang === 'en' ? "Mr. Tolosa Gemechu" : "አቶ ቶሎሳ ገመቹ",
            title: lang === 'en' ? "Afaan Oromo Teacher" : "የአፋን ኦሮሞ መምህር",
            bio: lang === 'en' ? "Mr. Tolosa is dedicated to teaching the Afaan Oromo language and culture, helping students develop strong linguistic skills and cultural appreciation." : "አቶ ቶሎሳ የአፋን ኦሮሞ ቋንቋን እና ባህልን በማስተማር፣ ተማሪዎች ጠንካራ የቋንቋ ክህሎት እና የባህል አድናቆት እንዲያዳብሩ በመርዳት ላይ ያተኩራሉ።",
            photo: "https://picsum.photos/seed/tolosa/400/400"
          }
        ];

        try {
          for (const teacher of teachers) {
            await setDoc(doc(db, 'faculty', teacher.id.toString()), teacher);
          }
        } catch (error) {
          console.error("Error seeding faculty:", error);
        }
      }
    };
    seedFacultyIfEmpty();
  }, [isLoggedIn, userRole, faculty.length, lang]);

  // Separate effect for messages based on role and selected student
  useEffect(() => {
    if (!isLoggedIn) return;

    let messagesUnsubscribe: () => void = () => {};
    let studentMessagesUnsubscribe: () => void = () => {};
    let teacherMessagesUnsubscribe: () => void = () => {};
    let gradesUnsubscribe: () => void = () => {};
    let studentsUnsubscribe: () => void = () => {};
    let teachersUnsubscribe: () => void = () => {};
    let admissionsUnsubscribe: () => void = () => {};

    if (userRole === 'Director') {
      studentsUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
        const studentsList = snapshot.docs.map(doc => ({ ...doc.data() } as Student));
        setStudents(studentsList);
        
        // Also fetch grades for all students
        snapshot.docs.forEach(async (studentDoc) => {
          const gradesSnapshot = await getDocs(collection(db, 'students', studentDoc.id, 'grades'));
          const gradesList = gradesSnapshot.docs.map(doc => doc.data() as GradeEntry);
          setStudentGrades(prev => ({ ...prev, [studentDoc.id]: gradesList }));
        });
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

      teachersUnsubscribe = onSnapshot(collection(db, 'teachers'), (snapshot) => {
        setTeachers(snapshot.docs.map(doc => doc.data() as Teacher));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'teachers'));

      admissionsUnsubscribe = onSnapshot(collection(db, 'admissions'), (snapshot) => {
        setAdmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'admissions'));

      messagesUnsubscribe = onSnapshot(collection(db, 'messages'), (snapshot) => {
        setDirectorMessages(snapshot.docs.map(doc => doc.data() as any));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));

      teacherMessagesUnsubscribe = onSnapshot(collection(db, 'teacher_messages'), (snapshot) => {
        setTeacherMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacher_messages'));

      if (messagingStudent) {
        studentMessagesUnsubscribe = onSnapshot(collection(db, 'students', messagingStudent.id, 'messages'), (snapshot) => {
          setStudentMessages(snapshot.docs.map(doc => doc.data() as any));
        }, (error) => handleFirestoreError(error, OperationType.GET, `students/${messagingStudent.id}/messages`));
      }

      if (viewingStudentGrades) {
        gradesUnsubscribe = onSnapshot(collection(db, 'students', viewingStudentGrades, 'grades'), (snapshot) => {
          const gradesList = snapshot.docs.map(doc => doc.data() as GradeEntry);
          setStudentGrades(prev => ({ ...prev, [viewingStudentGrades]: gradesList }));
        }, (error) => handleFirestoreError(error, OperationType.GET, `students/${viewingStudentGrades}/grades`));
      }
    } else if (userRole === 'Teacher' && userData?.id) {
      teacherMessagesUnsubscribe = onSnapshot(
        query(collection(db, 'teacher_messages'), where('senderId', '==', userData.id)),
        (snapshot) => {
          const sentMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage));
          // Also fetch messages where receiverId is the teacher
          const receiverQuery = query(collection(db, 'teacher_messages'), where('receiverId', '==', userData.id));
          getDocs(receiverQuery).then(receiverSnapshot => {
            const receivedMessages = receiverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMessage));
            setTeacherMessages([...sentMessages, ...receivedMessages].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
          });
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacher_messages'));
    } else if (userRole === 'Student' && userData?.id) {
      studentMessagesUnsubscribe = onSnapshot(collection(db, 'students', userData.id, 'messages'), (snapshot) => {
        setStudentMessages(snapshot.docs.map(doc => doc.data() as any));
      }, (error) => handleFirestoreError(error, OperationType.GET, `students/${userData.id}/messages`));

      gradesUnsubscribe = onSnapshot(collection(db, 'students', userData.id, 'grades'), (snapshot) => {
        const gradesList = snapshot.docs.map(doc => doc.data() as GradeEntry);
        setStudentGrades(prev => ({ ...prev, [userData.id]: gradesList }));
      }, (error) => handleFirestoreError(error, OperationType.GET, `students/${userData.id}/grades`));
    }

    return () => {
      messagesUnsubscribe();
      studentMessagesUnsubscribe();
      gradesUnsubscribe();
      studentsUnsubscribe();
      admissionsUnsubscribe();
    };
  }, [isLoggedIn, userRole, userData, messagingStudent, viewingStudentGrades]);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      let emailToSignIn = loginEmail;
      let registeredStudent: Student | null = null;
      let registeredTeacher: Teacher | null = null;
      const isEmail = loginEmail.includes('@');

      if (isEmail) {
        // If it's an email, check if it belongs to a student or teacher for auto-account creation logic
        if (loginType === 'student') {
          const studentQuery = query(collection(db, 'students'), where('email', '==', loginEmail));
          const studentSnapshot = await getDocs(studentQuery);
          if (!studentSnapshot.empty) {
            registeredStudent = studentSnapshot.docs[0].data() as Student;
          }
        } else if (loginType === 'teacher') {
          const teacherQuery = query(collection(db, 'teachers'), where('email', '==', loginEmail));
          const teacherSnapshot = await getDocs(teacherQuery);
          if (!teacherSnapshot.empty) {
            registeredTeacher = teacherSnapshot.docs[0].data() as Teacher;
          }
        }
        emailToSignIn = loginEmail;
      } else {
        // Assume it's an ID (Student or Teacher)
        if (loginType === 'student') {
          const studentDoc = await getDoc(doc(db, 'students', loginEmail));
          if (studentDoc.exists()) {
            registeredStudent = studentDoc.data() as Student;
            emailToSignIn = registeredStudent.email;
          } else {
            setLoginError(lang === 'en' ? 'Invalid Student ID' : 'ትክክለኛ ያልሆነ የተማሪ መታወቂያ');
            setIsLoggingIn(false);
            return;
          }
        } else if (loginType === 'teacher') {
          const teacherDoc = await getDoc(doc(db, 'teachers', loginEmail));
          if (teacherDoc.exists()) {
            registeredTeacher = teacherDoc.data() as Teacher;
            emailToSignIn = registeredTeacher.email;
          } else {
            setLoginError(lang === 'en' ? 'Invalid Teacher ID' : 'ትክክለኛ ያልሆነ የመምህር መታወቂያ');
            setIsLoggingIn(false);
            return;
          }
        } else {
          // Director must use email
          setLoginError(lang === 'en' ? 'Director must use email to login' : 'ዳይሬክተሩ ለመግባት ኢሜይል መጠቀም አለባቸው');
          setIsLoggingIn(false);
          return;
        }
      }

      // Enforce director credentials strictly
      const isDirectorEmail = emailToSignIn === 'abebeeyob64@gmail.com';
      if (isDirectorEmail && loginPassword !== 'Rg8A9YBb434') {
        setLoginError(lang === 'en' ? 'Invalid email or password' : 'ትክክለኛ ያልሆነ ኢሜይል ወይም የይለፍ ቃል');
        setIsLoggingIn(false);
        return;
      }

      // Also prevent others from using the director email
      if (!isDirectorEmail && emailToSignIn.toLowerCase() === 'abebeeyob64@gmail.com') {
        setLoginError(lang === 'en' ? 'Invalid email or password' : 'ትክክለኛ ያልሆነ ኢሜይል ወይም የይለፍ ቃል');
        setIsLoggingIn(false);
        return;
      }

      // Password strength validation
      if (loginPassword.length > 0 && passwordStrength < 2) {
        setLoginError(lang === 'en' ? 'Password is too weak. Please use a stronger password.' : 'የይለፍ ቃል በጣም ደካማ ነው። እባክዎ ጠንካራ የይለፍ ቃል ይጠቀሙ።');
        setIsLoggingIn(false);
        return;
      }

      // Check if user is registered in Firestore
      if (!isDirectorEmail && !registeredStudent && !registeredTeacher) {
        setLoginError(lang === 'en' ? 'Access Denied: You are not registered. Please contact the director.' : 'መግቢያ ተከልክሏል፡ አልተመዘገቡም። እባክዎ ዳይሬክተሩን ያነጋግሩ።');
        setIsLoggingIn(false);
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, emailToSignIn, loginPassword);
      } catch (error: any) {
        // Special case for the director, students, and teachers to make it work out of the box
        const isDirectorEmail = emailToSignIn === 'abebeeyob64@gmail.com';
        
        if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/invalid-api-key' || error.code === 'auth/network-request-failed') {
          // FALLBACK: Simulated Login without Firebase Console configuration or with invalid API key
          if (isDirectorEmail && loginPassword === 'Rg8A9YBb434') {
            setIsSimulatedSession(true);
            setIsLoggedIn(true);
            setUserRole('Director');
            setUserData({
              name: 'School Director',
              email: 'abebeeyob64@gmail.com',
              photo: 'https://picsum.photos/seed/director/200',
              id: 'DIRECTOR',
              studentId: '',
              teacherId: '',
              grade: '',
              enrollmentDate: '',
              title: 'Director',
              hasIdCard: false,
              subject: ''
            });
            setIsAuthReady(true);
            return;
          } else if (registeredStudent && loginPassword === (registeredStudent.password || 'Student@123')) {
            setIsSimulatedSession(true);
            setIsLoggedIn(true);
            setUserRole('Student');
            setUserData({
              name: registeredStudent.name,
              email: registeredStudent.email,
              photo: registeredStudent.photo || 'https://picsum.photos/seed/student/200',
              id: registeredStudent.id,
              studentId: registeredStudent.id,
              teacherId: '',
              grade: registeredStudent.grade,
              enrollmentDate: registeredStudent.enrollmentDate,
              title: '',
              hasIdCard: registeredStudent.hasIdCard || false,
              subject: ''
            });
            setIsAuthReady(true);
            return;
          } else if (registeredTeacher && loginPassword === (registeredTeacher.password || 'Teacher@123')) {
            setIsSimulatedSession(true);
            setIsLoggedIn(true);
            setUserRole('Teacher');
            setUserData({
              name: registeredTeacher.name,
              email: registeredTeacher.email,
              photo: registeredTeacher.photo || 'https://picsum.photos/seed/teacher/200',
              id: registeredTeacher.id,
              studentId: '',
              teacherId: registeredTeacher.id,
              grade: '',
              enrollmentDate: '',
              title: 'Teacher',
              hasIdCard: false,
              subject: registeredTeacher.subject
            });
            setIsAuthReady(true);
            return;
          }
          
          // If fallback fails due to wrong password in simulated mode
          if (error.code === 'auth/operation-not-allowed') {
             setLoginError(lang === 'en' ? 'Invalid email or password' : 'ትክክለኛ ያልሆነ ኢሜይል ወይም የይለፍ ቃል');
             setIsLoggingIn(false);
             return;
          }
          throw error;
        }

        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          if (isDirectorEmail && loginPassword === 'Rg8A9YBb434') {
            // Create Firebase Auth account for director if it doesn't exist
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, emailToSignIn, loginPassword);
              if (userCredential.user) {
                await sendEmailVerification(userCredential.user);
                alert(lang === 'en' ? 'Director account created! Verification email sent.' : 'የዳይሬክተር አካውንት ተፈጥሯል! የማረጋገጫ ኢሜይል ተልኳል።');
              }
            } catch (createError: any) {
              throw error;
            }
          } else if (registeredStudent && loginPassword === (registeredStudent.password || 'Student@123')) {
            // Create Firebase Auth account for registered student
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, emailToSignIn, loginPassword);
              if (userCredential.user) {
                await sendEmailVerification(userCredential.user);
                alert(lang === 'en' ? 'Student account created! Verification email sent.' : 'የተማሪ አካውንት ተፈጥሯል! የማረጋገጫ ኢሜይል ተልኳል።');
              }
            } catch (createError: any) {
              throw error;
            }
          } else if (registeredTeacher && loginPassword === (registeredTeacher.password || 'Teacher@123')) {
            // Create Firebase Auth account for registered teacher
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, emailToSignIn, loginPassword);
              if (userCredential.user) {
                await sendEmailVerification(userCredential.user);
                alert(lang === 'en' ? 'Teacher account created! Verification email sent.' : 'የመምህር አካውንት ተፈጥሯል! የማረጋገጫ ኢሜይል ተልኳል።');
              }
            } catch (createError: any) {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      setIsLoginModalOpen(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError(lang === 'en' 
          ? 'Email/Password login is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable "Email/Password".' 
          : 'የኢሜይል/የይለፍ ቃል መግቢያ በFirebase Console ውስጥ አልነቃም። እባክዎ ወደ Authentication > Sign-in method ይሂዱ እና "Email/Password" የሚለውን ያብሩ።');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError('Invalid email or password');
      } else {
        setLoginError('An error occurred during login. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setResetSuccess(false);
    setIsLoggingIn(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess(true);
      setResetEmail('');
    } catch (error: any) {
      console.error("Password reset error:", error);
      let errorMessage = lang === 'en' ? 'Error sending reset email. Please try again.' : 'የይለፍ ቃል ዳግም ማስጀመሪያ ኢሜይል በመላክ ላይ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = lang === 'en' ? 'No user found with this email address.' : 'በዚህ ኢሜይል አድራሻ የተመዘገበ ተጠቃሚ አልተገኘም።';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = lang === 'en' ? 'Invalid email address format.' : 'ትክክለኛ ያልሆነ የኢሜይል አድራሻ ቅርጸት።';
      }
      
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  async function handleGoogleLogin() {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameters if needed
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setIsLoginModalOpen(false);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError(lang === 'en' ? 'Popup blocked! Please allow popups for this site.' : 'ፖፕ-አፕ ተከልክሏል! እባክዎ ለዚህ ድረ-ገጽ ፖፕ-አፕ ይፍቀዱ።');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User closed the popup, no need to show error
      } else if (error.code === 'auth/operation-not-allowed') {
        setLoginError(lang === 'en'
          ? 'Google login is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable "Google".'
          : 'የGoogle መግቢያ በFirebase Console ውስጥ አልነቃም። እባክዎ ወደ Authentication > Sign-in method ይሂዱ እና "Google" የሚለውን ያብሩ።');
      } else {
        setLoginError(lang === 'en' ? 'An error occurred during Google login.' : 'በGoogle መግቢያ ወቅት ስህተት ተከስቷል።');
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  const handleLogout = async () => {
    try {
      if (!isSimulatedSession) {
        await signOut(auth);
      }
      setIsSimulatedSession(false);
      setIsLoggedIn(false);
      setUserRole(null);
      setUserData({ name: '', grade: '', id: '', studentId: '', teacherId: '', photo: '', email: '', enrollmentDate: '', title: '', hasIdCard: false, subject: '' });
      setActivePage('Home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [statusSearchEmail, setStatusSearchEmail] = useState('');
  const [foundAdmissions, setFoundAdmissions] = useState<any[]>([]);
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [statusSearchError, setStatusSearchError] = useState<string | null>(null);

  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  const validateContactForm = () => {
    const errors: Record<string, string> = {};
    const trimmedName = contactForm.name.trim();
    const trimmedEmail = contactForm.email.trim();
    const trimmedSubject = contactForm.subject.trim();
    const trimmedMessage = contactForm.message.trim();

    if (!trimmedName) {
      errors.name = lang === 'en' ? 'Name is required' : 'ስም ያስፈልጋል';
    } else if (trimmedName.length < 2) {
      errors.name = lang === 'en' ? 'Name must be at least 2 characters' : 'ስም ቢያንስ 2 ፊደላት መሆን አለበት';
    }

    if (!trimmedEmail) {
      errors.email = lang === 'en' ? 'Email is required' : 'ኢሜይል ያስፈልጋል';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = lang === 'en' ? 'Invalid email format' : 'ትክክለኛ ያልሆነ የኢሜይል ቅርጸት';
    }

    if (!trimmedSubject) {
      errors.subject = lang === 'en' ? 'Subject is required' : 'ርዕሰ ጉዳይ ያስፈልጋል';
    } else if (trimmedSubject.length < 3) {
      errors.subject = lang === 'en' ? 'Subject must be at least 3 characters' : 'ርዕሰ ጉዳይ ቢያንስ 3 ፊደላት መሆን አለበት';
    }

    if (!trimmedMessage) {
      errors.message = lang === 'en' ? 'Message is required' : 'መልዕክት ያስፈልጋል';
    } else if (trimmedMessage.length < 10) {
      errors.message = lang === 'en' ? 'Message must be at least 10 characters' : 'መልዕክት ቢያንስ 10 ፊደላት መሆን አለበት';
    }
    
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (validateContactForm()) {
      try {
        const messageId = Date.now().toString();
        const messageData = {
          id: messageId,
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          subject: contactForm.subject.trim(),
          message: contactForm.message.trim(),
          timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, 'messages', messageId), messageData);
        setIsContactSubmitted(true);
        setContactForm({ name: '', email: '', subject: '', message: '' });
        setContactErrors({});
        setTimeout(() => {
          setIsContactSubmitted(false);
        }, 5000);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'messages');
      }
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!admissionForm.studentName) errors.studentName = 'Student name is required';
    if (!admissionForm.grade) errors.grade = 'Grade is required';
    if (!admissionForm.guardianName) errors.guardianName = 'Guardian name is required';
    if (!admissionForm.guardianPhone) errors.guardianPhone = 'Phone number is required';
    if (!admissionForm.guardianEmail) {
      errors.guardianEmail = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(admissionForm.guardianEmail)) {
      errors.guardianEmail = 'Invalid email format';
    }
    if (!admissionForm.previousSchool) errors.previousSchool = 'Previous school is required';
    if (!admissionForm.lastGrade) errors.lastGrade = 'Last grade completed is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusSearchEmail) return;
    setIsSearchingStatus(true);
    setStatusSearchError(null);
    try {
      const q = query(collection(db, 'admissions'), where('guardianEmail', '==', statusSearchEmail));
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFoundAdmissions(results);
      if (results.length === 0) {
        setStatusSearchError(lang === 'en' ? 'No applications found for this email.' : 'ለዚህ ኢሜይል ምንም ማመልከቻ አልተገኘም።');
      }
    } catch (error) {
      console.error('Error searching status:', error);
      setStatusSearchError(lang === 'en' ? 'Error searching status. Please try again.' : 'ሁኔታውን በመፈለግ ላይ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSearchingStatus(false);
    }
  };

  const handleAdmissionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        const admissionId = Date.now().toString();
        await setDoc(doc(db, 'admissions', admissionId), {
          ...admissionForm,
          id: admissionId,
          timestamp: new Date().toISOString()
        });
        setIsSubmitted(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setIsSubmitted(false);
          setAdmissionForm({
            studentName: '',
            grade: '',
            guardianName: '',
            guardianPhone: '',
            guardianEmail: '',
            previousSchool: '',
            lastGrade: ''
          });
        }, 5000);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'admissions');
      }
    }
  };

  const generateNextStudentId = () => {
    const currentYear = new Date().getFullYear();
    const prefix = `AGS-${currentYear}-`;
    const yearStudents = students.filter(s => s.id.startsWith(prefix));
    let nextNum = 1;
    if (yearStudents.length > 0) {
      const nums = yearStudents.map(s => {
        const parts = s.id.split('-');
        return parts.length === 3 ? parseInt(parts[2], 10) : 0;
      }).filter(n => !isNaN(n));
      if (nums.length > 0) {
        nextNum = Math.max(...nums) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const generateNextTeacherId = () => {
    const prefix = 'T-';
    const teacherIds = faculty.map(f => f.teacherId).filter(id => id && id.startsWith(prefix));
    let nextNum = 1;
    if (teacherIds.length > 0) {
      const nums = teacherIds.map(id => {
        const parts = id.split('-');
        return parts.length === 2 ? parseInt(parts[1], 10) : 0;
      }).filter(n => !isNaN(n));
      if (nums.length > 0) {
        nextNum = Math.max(...nums) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 400;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        callback(compressedBase64);
        setIsUploading(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddFaculty = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const id = Date.now();
      const newFacultyObj: FacultyMember = {
        id,
        teacherId: newFaculty.teacherId,
        name: newFaculty.name,
        title: newFaculty.title,
        bio: newFaculty.bio,
        photo: newFaculty.photo || `https://picsum.photos/seed/faculty${id}/400/500`
      };
      await setDoc(doc(db, 'faculty', id.toString()), newFacultyObj);
      setIsAddingFaculty(false);
      setNewFaculty({ name: '', title: '', bio: '', photo: '', teacherId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'faculty');
    }
  };

  const handleDeleteFaculty = async (id: number) => {
    try {
      await deleteDoc(doc(db, 'faculty', id.toString()));
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'faculty');
    }
  };

  const handleIssueIdCard = async (studentId: string) => {
    try {
      await updateDoc(doc(db, 'students', studentId), { hasIdCard: true });
      
      // Also send a message to the student
      const messageId = Date.now();
      const newMessage: StudentMessage = {
        id: messageId,
        studentId: studentId,
        from: 'Director',
        content: lang === 'en' 
          ? 'Congratulations! Your official Student ID Card has been issued. You can now view and print it from your dashboard.' 
          : 'እንኳን ደስ አለዎት! የእርስዎ ይፋዊ የተማሪ መታወቂያ ካርድ ተሰጥቷል። አሁን ከዳሽቦርድዎ ማየት እና ማተም ይችላሉ።',
        date: new Date().toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' }),
        category: 'General'
      };
      
      await addDoc(collection(db, 'students', studentId, 'messages'), newMessage);
      
      alert(lang === 'en' ? 'ID Card issued and sent to student!' : 'መታወቂያ ተሰጥቶ ለተማሪው ተልኳል!');
      setIsViewingIdCard(false);
      setViewingIdCard(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const handleAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const id = newStudent.id || generateNextStudentId();
      const newStudentObj: Student = {
        id,
        name: newStudent.name,
        grade: newStudent.grade,
        email: newStudent.email,
        password: newStudent.password || 'Student@123',
        photo: newStudent.photo || `https://picsum.photos/seed/student${students.length + 1}/400/400`,
        enrollmentDate: new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' }),
        hasIdCard: false
      };
      await setDoc(doc(db, 'students', id), newStudentObj);
      setIsAddingStudent(false);
      setNewStudent({ name: '', grade: '', email: '', photo: '', id: '', password: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  };

  const handleEditStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), { ...editingStudent });
      setIsEditingStudent(false);
      setEditingStudent(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${editingStudent.id}`);
    }
  };

  const handleEditFaculty = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    
    try {
      await updateDoc(doc(db, 'faculty', editingFaculty.id.toString()), { ...editingFaculty });
      setIsEditingFaculty(false);
      setEditingFaculty(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `faculty/${editingFaculty.id}`);
    }
  };

  const handleSendMessageToFaculty = async (e: FormEvent) => {
    e.preventDefault();
    if (!messagingFaculty || !newMessageContent) return;

    try {
      const msgId = Date.now().toString();
      const msg: TeacherMessage = {
        id: msgId,
        senderId: 'Director',
        senderName: 'School Director',
        senderRole: 'director',
        receiverId: messagingFaculty.teacherId,
        content: newMessageContent,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        category: newMessageCategory,
        isRead: false
      };

      await setDoc(doc(db, 'faculty', messagingFaculty.id.toString(), 'messages', msgId), msg);
      setIsMessagingFaculty(false);
      setMessagingFaculty(null);
      setNewMessageContent('');
      setNewMessageCategory('General');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `faculty/${messagingFaculty.id}/messages`);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messagingStudent || !newMessageContent) return;

    try {
      const msgId = Date.now().toString();
      const msg: StudentMessage = {
        id: Number(msgId),
        studentId: messagingStudent.id,
        from: 'Director',
        content: newMessageContent,
        date: new Date().toISOString().split('T')[0],
        category: newMessageCategory
      };

      await setDoc(doc(db, 'students', messagingStudent.id, 'messages', msgId), msg);
      setIsMessagingStudent(false);
      setMessagingStudent(null);
      setNewMessageContent('');
      setNewMessageCategory('General');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${messagingStudent.id}/messages`);
    }
  };
  
  const calculateLetterGrade = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'B-';
    if (percentage >= 65) return 'C+';
    if (percentage >= 60) return 'C';
    return 'F';
  };

  const handleSaveAttendance = async () => {
    if (!userData || userData.role !== 'Teacher') return;
    setIsSavingAttendance(true);
    try {
      const attendanceId = `${userData.grade}_${attendanceDate}`;
      await setDoc(doc(db, 'attendance', attendanceId), {
        grade: userData.grade,
        date: attendanceDate,
        records: dailyAttendance,
        recordedBy: userData.id,
        timestamp: new Date().toISOString()
      });
      alert(lang === 'en' ? 'Attendance saved successfully!' : 'መገኘት በተሳካ ሁኔታ ተቀምጧል!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleAddAssignmentForClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!userData || userData.role !== 'Teacher') return;
    
    const subject = newAssignmentForm.subject || userData.subject;
    if (!subject) {
      alert(lang === 'en' ? 'Please select a subject' : 'እባክዎ የትምህርት አይነት ይምረጡ');
      return;
    }

    try {
      const gradeStudents = students.filter(s => s.grade === userData.grade);
      const batch = writeBatch(db);
      
      const assignmentId = Date.now();
      const newAssignment: Assignment = {
        id: assignmentId,
        title: newAssignmentForm.title,
        score: 0,
        total: Number(newAssignmentForm.total),
        status: 'Pending',
        date: newAssignmentForm.date
      };

      for (const student of gradeStudents) {
        const studentGradeRef = doc(db, 'students', student.id, 'grades', subject.replace(/\s+/g, '_').toLowerCase());
        const gradeSnap = await getDoc(studentGradeRef);
        
        let gradeData: GradeEntry;
        if (gradeSnap.exists()) {
          gradeData = gradeSnap.data() as GradeEntry;
          const assignments = [...(gradeData.assignments || [])];
          assignments.push(newAssignment);
          gradeData.assignments = assignments;
        } else {
          gradeData = {
            subject,
            grade: 'N/A',
            status: 'Started',
            attendance: '100%',
            color: 'text-slate-600',
            assignments: [newAssignment]
          };
        }
        batch.set(studentGradeRef, gradeData);
      }

      await batch.commit();
      setIsAddingAssignment(false);
      setNewAssignmentForm({ title: '', subject: '', total: '', date: new Date().toISOString().split('T')[0] });
      alert(lang === 'en' ? 'Assignment added to all students!' : 'ተግባሩ ለሁሉም ተማሪዎች ተጨምሯል!');
    } catch (error) {
      console.error('Error adding assignment:', error);
      alert('Error adding assignment. Please try again.');
    }
  };

  const handlePostGrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!postingGradeStudent || !newGradeForm.subject) return;

    try {
      const currentGrades = studentGrades[postingGradeStudent.id] || [];
      const existingGradeIndex = currentGrades.findIndex(g => g.subject === newGradeForm.subject);
      
      let gradeEntry: GradeEntry;

      if (existingGradeIndex >= 0) {
        gradeEntry = { ...currentGrades[existingGradeIndex] };
        // Ensure assignments are populated from currentStudentAssignments for calculation
        if (!gradeEntry.assignments || gradeEntry.assignments.length === 0) {
          gradeEntry.assignments = currentStudentAssignments[newGradeForm.subject] || [];
        }
      } else {
        // Create new subject entry if it doesn't exist
        gradeEntry = {
          subject: newGradeForm.subject,
          grade: 'N/A',
          status: 'Started',
          attendance: '100%',
          color: 'text-slate-600',
          assignments: []
        };
      }

      if (newGradeForm.assignmentId === 'overall') {
        // Update overall grade manually
        const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'N/A'];
        const normalizedGrade = newGradeForm.grade.toUpperCase().trim();
        
        if (!validGrades.includes(normalizedGrade)) {
          alert(lang === 'en' ? 'Please enter a valid grade (A, B+, etc.)' : 'እባክዎ ትክክለኛ ውጤት ያስገቡ (A, B+, ወዘተ)');
          return;
        }

        gradeEntry.grade = normalizedGrade;
        gradeEntry.status = newGradeForm.status || gradeEntry.status;
        gradeEntry.attendance = newGradeForm.attendance || gradeEntry.attendance;
        gradeEntry.color = ['A', 'A-'].includes(normalizedGrade) ? 'text-emerald-600' : 
                           ['B+', 'B', 'B-'].includes(normalizedGrade) ? 'text-blue-600' : 
                           ['C+', 'C'].includes(normalizedGrade) ? 'text-amber-600' : 'text-slate-600';
      } else {
        // Update or add specific assignment
        const assignments = [...(gradeEntry.assignments || [])];
        
        if (newGradeForm.assignmentId === 'new') {
          // Add new assignment
          const newAssignment: Assignment = {
            id: Date.now(),
            title: newGradeForm.assignmentTitle || 'New Assignment',
            score: Number(newGradeForm.score),
            total: Number(newGradeForm.total),
            status: 'Graded',
            date: new Date().toISOString().split('T')[0]
          };
          assignments.push(newAssignment);
        } else {
          // Update existing assignment
          const assignmentIndex = assignments.findIndex(a => a.id.toString() === newGradeForm.assignmentId);
          if (assignmentIndex >= 0) {
            assignments[assignmentIndex] = {
              ...assignments[assignmentIndex],
              score: Number(newGradeForm.score),
              total: Number(newGradeForm.total),
              status: 'Graded'
            };
          }
        }

        // Recalculate overall grade for the subject
        const gradedAssignments = assignments.filter(a => a.status === 'Graded');
        if (gradedAssignments.length > 0) {
          const totalScore = gradedAssignments.reduce((sum, a) => sum + a.score, 0);
          const totalMax = gradedAssignments.reduce((sum, a) => sum + a.total, 0);
          const percentage = (totalScore / totalMax) * 100;
          gradeEntry.grade = calculateLetterGrade(percentage);
          gradeEntry.color = ['A', 'A-'].includes(gradeEntry.grade) ? 'text-emerald-600' : 
                             ['B+', 'B', 'B-'].includes(gradeEntry.grade) ? 'text-blue-600' : 
                             ['C+', 'C'].includes(gradeEntry.grade) ? 'text-amber-600' : 'text-slate-600';
          gradeEntry.status = `${gradedAssignments.length}/${assignments.length} Completed`;
        }
        
        gradeEntry.assignments = assignments;
      }

      // Save to Firestore
      const gradeDocId = gradeEntry.subject.replace(/\s+/g, '_').toLowerCase();
      const studentId = postingGradeStudent.id;
      
      // Update the main grade entry (without assignments array to save space)
      const { assignments: _, ...gradeEntrySummary } = gradeEntry;
      const finalGradeEntry = {
        ...gradeEntrySummary,
        assignmentCount: gradeEntry.assignments?.length || 0
      };
      
      await setDoc(doc(db, 'students', studentId, 'grades', gradeDocId), finalGradeEntry);

      // Save the specific assignment to the subcollection if it was updated/added
      if (newGradeForm.assignmentId !== 'overall') {
        const assignments = gradeEntry.assignments || [];
        let assignmentToSave: Assignment | undefined;
        
        if (newGradeForm.assignmentId === 'new') {
          assignmentToSave = assignments[assignments.length - 1];
        } else {
          assignmentToSave = assignments.find(a => a.id.toString() === newGradeForm.assignmentId);
        }

        if (assignmentToSave) {
          await setDoc(doc(db, 'students', studentId, 'grades', gradeDocId, 'assignments', assignmentToSave.id.toString()), assignmentToSave);
        }
      } else {
        // If overall grade was updated, we might want to ensure all assignments are in the subcollection
        // But for now, we'll assume they are already there if they were added via this form.
      }

      setGradePostSuccess(true);
      setTimeout(() => {
        setGradePostSuccess(false);
        setIsPostingGrade(false);
        setPostingGradeStudent(null);
        setNewGradeForm({ subject: '', assignmentId: '', assignmentTitle: '', score: '', total: '', grade: '', status: '', attendance: '' });
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${postingGradeStudent.id}/grades`);
    }
  };

  const handleRegisterEvent = async (eventId: number) => {
    if (!isLoggedIn || !userData?.uid) {
      setIsLoginModalOpen(true);
      return;
    }

    const isRegistered = registeredEventIds.includes(eventId);
    const event = events.find(e => e.id === eventId);
    
    try {
      if (isRegistered) {
        // Unregister
        const q = query(
          collection(db, 'registrations'), 
          where('userId', '==', userData.uid),
          where('eventId', '==', eventId)
        );
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'registrations', d.id)));
        await Promise.all(deletePromises);
        
        setRegisteredEventIds(prev => prev.filter(id => id !== eventId));
      } else {
        // Register
        const registrationId = `${userData.uid}_${eventId}`;
        const newRegistration = {
          id: registrationId,
          eventId: eventId,
          eventTitle: event?.title || 'Unknown Event',
          userId: userData.uid,
          userName: userData.name || 'Anonymous',
          userEmail: userData.email || '',
          timestamp: Timestamp.now()
        };
        await setDoc(doc(db, 'registrations', registrationId), newRegistration);
        
        setRegisteredEventIds(prev => [...prev, eventId]);
        setRegistrationSuccess(true);
        setTimeout(() => setRegistrationSuccess(false), 3000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'registrations');
    }
  };

  const getRegistrationCount = (eventId: number) => {
    // Base count based on event ID to make it look realistic for a school
    const baseCount = (eventId * 13) % 25 + 15; 
    // Add 1 if the current student is registered
    return baseCount + (registeredEventIds.includes(eventId) ? 1 : 0);
  };

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id.toString()), { ...editingEvent, ...newEventForm });
      } else {
        const eventId = Date.now().toString();
        const newEvent: SchoolEvent = {
          ...newEventForm,
          id: Number(eventId)
        };
        await setDoc(doc(db, 'events', eventId), newEvent);
      }
      setIsManagingCalendar(false);
      setEditingEvent(null);
      setNewEventForm({ title: '', date: '', time: '', location: '', description: '', category: 'Academic' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (window.confirm(lang === 'en' ? 'Are you sure you want to delete this event?' : 'ይህን ኩነት ለመሰረዝ እርግጠኛ ነዎት?')) {
      try {
        await deleteDoc(doc(db, 'events', id.toString()));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
      }
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          name: editProfileData.name,
          grade: editProfileData.grade,
          photoUrl: editProfileData.photo
        });
        setIsEditingProfile(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser?.uid}`);
    }
  };

  const navLinks: { name: Page; label: string }[] = [
    { name: 'Home', label: t.nav.home },
    { name: 'About', label: t.nav.about },
    { name: 'Admissions', label: t.nav.admissions },
    { name: 'Academics', label: t.nav.academics },
    { name: 'Faculty', label: t.nav.faculty },
    { name: 'Blog', label: t.nav.blog },
    { name: 'Events', label: t.nav.events },
    { name: 'Contact', label: t.nav.contact },
  ];

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentMonth.toLocaleString('default', { month: 'long' });

    const days = [];
    // Empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 md:h-32 border border-slate-100 bg-slate-50/50"></div>);
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr && (eventCategoryFilter === 'All' || e.category === eventCategoryFilter));
      const isToday = d === 20 && month === 2 && year === 2026; // Highlight March 20, 2026

      days.push(
        <div key={d} className={`h-24 md:h-32 border border-slate-100 p-2 transition-colors hover:bg-slate-50 relative ${isToday ? 'bg-blue-50/30' : ''}`}>
          <span className={`text-sm font-bold ${isToday ? 'text-blue-600 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
            {d}
          </span>
          <div className="mt-1 space-y-1 overflow-y-auto max-h-[calc(100%-1.5rem)]">
            {dayEvents.map(event => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`w-full text-left px-2 py-1 rounded text-[10px] md:text-xs font-semibold truncate transition-transform hover:scale-[1.02] active:scale-95 ${
                  event.category === 'Academic' ? 'bg-blue-100 text-blue-700 border-l-2 border-blue-500' :
                  event.category === 'Sports' ? 'bg-emerald-100 text-emerald-700 border-l-2 border-emerald-500' :
                  event.category === 'Holiday' ? 'bg-amber-100 text-amber-700 border-l-2 border-amber-500' :
                  'bg-purple-100 text-purple-700 border-l-2 border-purple-500'
                }`}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Filter UI */}
        <div className="flex flex-wrap items-center justify-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-bold text-slate-500 mr-2">{lang === 'en' ? 'Filter by:' : 'በዚህ ይለዩ:'}</span>
          {(['All', 'Academic', 'Sports', 'Social', 'Holiday'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setEventCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                eventCategoryFilter === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {cat === 'All' ? (lang === 'en' ? 'All' : 'ሁሉም') :
               cat === 'Academic' ? (lang === 'en' ? 'Academic' : 'ትምህርታዊ') :
               cat === 'Sports' ? (lang === 'en' ? 'Sports' : 'ስፖርታዊ') :
               cat === 'Social' ? (lang === 'en' ? 'Social' : 'ማህበራዊ') :
               (lang === 'en' ? 'Holiday' : 'በዓል')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
        <div className="bg-[#0f172a] p-6 flex items-center justify-between text-white">
          <h2 className="text-2xl font-bold">{monthName} {year}</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentMonth(new Date(year, month - 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date(year, month + 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days}
        </div>
      </div>
    </div>
    );
  };

  const renderContent = () => {
    switch (activePage) {
      case 'Home':
        return (
          <>
            {/* Hero Section */}
            <section className="relative min-h-[85vh] flex items-center bg-[#0f172a] overflow-hidden">
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop" 
                  alt="School background" 
                  className="w-full h-full object-cover opacity-20"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent"></div>
              </div>

              <div className="container mx-auto px-6 md:px-12 relative z-10">
                <motion.div 
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-3xl"
                >
                  <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-500/30 rounded-full px-4 py-1.5 mb-6 md:mb-8 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Globe className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-blue-100 text-[10px] md:text-xs font-semibold tracking-wide uppercase">
                      {t.hero.welcome}
                    </span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
                    {t.hero.title}
                  </h1>

                  <p className="text-base md:text-xl text-slate-300 mb-8 md:mb-10 leading-relaxed max-w-2xl">
                    {t.hero.subtitle}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all transform hover:scale-105 shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2">
                      {t.hero.ctaPrimary}
                    </button>
                    <button className="bg-slate-800/50 hover:bg-slate-800 text-white border border-slate-700 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all backdrop-blur-md flex items-center justify-center gap-2">
                      {t.hero.ctaSecondary}
                    </button>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Quick Stats / Features Section */}
            <section className="py-20 bg-white">
              <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {t.home.features.map((feature, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ y: -5 }}
                      className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                        {i === 0 ? <BookOpen className="text-blue-600" /> : i === 1 ? <Users className="text-blue-600" /> : <Award className="text-blue-600" />}
                      </div>
                      <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Latest News Section */}
            <section className="py-24 bg-slate-50">
              <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                      <Newspaper className="w-4 h-4" />
                      {t.hero.ctaSecondary}
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">{t.home.newsTitle}</h2>
                    <p className="text-slate-600 text-lg">
                      {t.home.newsSubtitle}
                    </p>
                  </div>
                  <button className="group flex items-center gap-3 text-blue-600 font-bold hover:text-blue-700 transition-colors">
                    {t.home.viewAllNews}
                    <div className="w-10 h-10 rounded-full border border-blue-200 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {newsItems.slice(0, 3).map((item) => (
                    <motion.div 
                      key={item.id}
                      whileHover={{ y: -5 }}
                      className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all"
                    >
                      <div className="text-slate-400 text-xs font-bold mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 leading-tight">{item.title}</h3>
                      <p className="text-slate-600 text-sm line-clamp-3 mb-6">
                        {item.content}
                      </p>
                      <button 
                        onClick={() => setSelectedContent({ title: item.title, content: item.content, date: item.date })}
                        className="text-blue-600 font-bold text-sm hover:underline"
                      >
                        {t.home.readMore}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </>
        );
      case 'About':
        return (
          <div className="bg-white">
            {/* Hero Section */}
            <section className="relative py-32 bg-[#0f172a] overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <img 
                  src="https://images.unsplash.com/photo-1541339907198-e08756ebafe3?q=80&w=2070&auto=format&fit=crop" 
                  alt="School building" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/60 to-[#0f172a]"></div>
              </div>
              <div className="container mx-auto px-6 md:px-12 relative z-10 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-4xl mx-auto"
                >
                  <span className="inline-block px-4 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                    {t.about.established}
                  </span>
                  <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter">
                    {t.about.heroTitle}
                  </h1>
                  <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-light">
                    {t.about.heroSubtitle}
                  </p>
                </motion.div>
              </div>
            </section>

            {/* Message from the Principal */}
            <section className="py-24 bg-white">
              <div className="container mx-auto px-6 md:px-12">
                <div className="bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col lg:flex-row">
                  <div className="lg:w-1/3 relative min-h-[400px]">
                    <img 
                      src={facultyMembers[0].photo} 
                      alt={facultyMembers[0].name} 
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="lg:w-2/3 p-12 md:p-20 flex flex-col justify-center">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                    >
                      <Quote className="w-16 h-16 text-blue-500/20 mb-8" />
                      <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
                        {t.about.principalMessage}
                      </h2>
                      <div className="space-y-6 text-slate-400 text-lg leading-relaxed mb-12">
                        <p>
                          {t.about.principalWelcome}
                        </p>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">{facultyMembers[0].name}</div>
                        <div className="text-blue-500 font-medium tracking-widest uppercase text-xs mt-1">{facultyMembers[0].title}</div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </section>

            {/* Our Journey Section */}
            <section className="py-32 bg-slate-50 relative overflow-hidden">
              <div className="container mx-auto px-6 md:px-12">
                <div className="flex flex-col lg:flex-row items-center gap-20">
                  <motion.div 
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="lg:w-1/2"
                  >
                    <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                      <Target className="w-4 h-4" />
                      {t.about.journeyBadge}
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black text-[#0f172a] mb-8 leading-tight">
                      {t.about.journeyTitle}
                    </h2>
                    <p className="text-xl text-slate-600 leading-relaxed mb-10">
                      {t.about.journeyDesc}
                    </p>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                        <div className="text-4xl font-black text-blue-600 mb-2">{lang === 'en' ? '30+' : '30+'}</div>
                        <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{lang === 'en' ? 'Years of Excellence' : 'የላቀ ውጤት ዓመታት'}</div>
                      </div>
                      <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                        <div className="text-4xl font-black text-blue-600 mb-2">5k+</div>
                        <div className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{lang === 'en' ? 'Graduates' : 'ምሩቃን'}</div>
                      </div>
                    </div>
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="lg:w-1/2 relative"
                  >
                    <div className="aspect-square rounded-[4rem] overflow-hidden shadow-2xl relative z-10">
                      <img 
                        src="https://images.unsplash.com/photo-1541339907198-e08756ebafe3?q=80&w=2070&auto=format&fit=crop" 
                        alt="School journey" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-20 -z-0"></div>
                    <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-600 rounded-full blur-3xl opacity-20 -z-0"></div>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* Mission, Vision, Values - Expanded */}
            <section className="py-32 bg-white">
              <div className="container mx-auto px-6 md:px-12">
                <div className="text-center mb-20">
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">{t.aboutPage.foundationTitle}</h2>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    {t.aboutPage.foundationSubtitle}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="group bg-slate-50 p-12 rounded-[3rem] transition-all hover:bg-blue-600 hover:shadow-2xl hover:shadow-blue-600/20"
                  >
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white/20">
                      <Target className="w-8 h-8 text-blue-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-white">{t.aboutPage.missionTitle}</h3>
                    <p className="text-slate-600 leading-relaxed group-hover:text-blue-50/80">
                      {t.aboutPage.missionDesc}
                    </p>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="group bg-slate-50 p-12 rounded-[3rem] transition-all hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-600/20"
                  >
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white/20">
                      <Globe className="w-8 h-8 text-emerald-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-white">{t.aboutPage.visionTitle}</h3>
                    <p className="text-slate-600 leading-relaxed group-hover:text-emerald-50/80">
                      {t.aboutPage.visionDesc}
                    </p>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="group bg-slate-50 p-12 rounded-[3rem] transition-all hover:bg-amber-600 hover:shadow-2xl hover:shadow-amber-600/20"
                  >
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white/20">
                      <Award className="w-8 h-8 text-amber-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-white">{t.aboutPage.valuesTitle}</h3>
                    <div className="space-y-4">
                      {t.aboutPage.values.map((v, i) => (
                        <div key={i} className="flex gap-4">
                          <CheckCircle className="w-5 h-5 text-amber-500 group-hover:text-white shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-white text-sm">{v.t}</div>
                            <div className="text-xs text-slate-500 group-hover:text-white/70">{v.d}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* Leadership Section */}
            <section className="py-32 bg-slate-900 text-white">
              <div className="container mx-auto px-6 md:px-12">
                <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-blue-500/30">
                      <Users className="w-4 h-4" />
                      {t.aboutPage.leadershipBadge}
                    </div>
                    <h2 className="text-5xl font-black mb-6">{t.aboutPage.leadershipTitle}</h2>
                    <p className="text-slate-400 text-lg">
                      {t.aboutPage.leadershipSubtitle}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActivePage('Faculty')}
                    className="group flex items-center gap-3 text-blue-400 font-bold hover:text-white transition-colors"
                  >
                    {t.aboutPage.viewAllFaculty}
                    <div className="w-10 h-10 rounded-full border border-blue-400/30 flex items-center justify-center group-hover:bg-blue-500 group-hover:border-blue-500 transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {facultyMembers.slice(0, 3).map((member) => (
                    <motion.div
                      key={member.id}
                      whileHover={{ y: -10 }}
                      className="group"
                    >
                      <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden mb-8 shadow-2xl">
                        <img 
                          src={member.photo} 
                          alt={member.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                        <div className="absolute inset-0 flex flex-col justify-end p-10 translate-y-4 group-hover:translate-y-0 transition-transform">
                          <h3 className="text-2xl font-bold text-white mb-1">{member.name}</h3>
                          <p className="text-blue-400 font-medium tracking-widest uppercase text-xs mb-4">{member.title}</p>
                          <p className="text-slate-300 text-sm line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            {member.bio}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Accreditation Section */}
            <section className="py-20 md:py-32 bg-white">
              <div className="container mx-auto px-6 md:px-12">
                <div className="bg-blue-600 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-24 text-center text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
                  
                  <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-md">
                      <Shield className="w-4 h-4" />
                      {t.aboutPage.accreditationBadge}
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black mb-10 tracking-tight">{t.aboutPage.accreditationTitle}</h2>
                    <p className="text-blue-100 text-xl mb-16 leading-relaxed">
                      {t.aboutPage.accreditationDesc}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                      {[
                        { name: lang === 'en' ? 'Ministry of Education' : 'የትምህርት ሚኒስቴር', logo: 'https://picsum.photos/seed/acc1/200/200' },
                        { name: lang === 'en' ? 'International Schools Assoc.' : 'የዓለም አቀፍ ትምህርት ቤቶች ማህበር', logo: 'https://picsum.photos/seed/acc2/200/200' },
                        { name: lang === 'en' ? 'STEM Excellence Board' : 'የSTEM የላቀ ውጤት ቦርድ', logo: 'https://picsum.photos/seed/acc3/200/200' },
                        { name: lang === 'en' ? 'Global Educators Network' : 'የዓለም አቀፍ መምህራን መረብ', logo: 'https://picsum.photos/seed/acc4/200/200' }
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-6 group">
                          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center p-6 shadow-xl transition-transform group-hover:scale-110">
                            <img 
                              src={item.logo} 
                              alt={item.name} 
                              className="w-full h-full object-contain grayscale opacity-80"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      case 'Admissions':
        return (
          <section className="py-24 bg-slate-50 min-h-[80vh]">
            <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                {/* Left Column: Info */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-10"
                >
                  <div>
                    <h1 className="text-5xl md:text-6xl font-bold text-[#0f172a] mb-6">{t.nav.admissions}</h1>
                    <p className="text-xl text-slate-600 leading-relaxed">
                      {t.admissions.subtitle}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-slate-900">{t.admissions.title}</h3>
                    <div className="space-y-4">
                      {t.admissions.steps.map((item, i) => (
                        <div key={i} className="flex gap-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <span className="text-3xl font-black text-blue-100">{item.step}</span>
                          <div>
                            <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                            <p className="text-slate-500 text-sm">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Check Status Section */}
                    <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold">{lang === 'en' ? 'Check Application Status' : 'የማመልከቻ ሁኔታን ያረጋግጡ'}</h3>
                        <button 
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          {t.payment.title}
                        </button>
                      </div>
                      <p className="text-blue-100 text-sm mb-6">{lang === 'en' ? 'Enter your guardian email to see your application status and director replies.' : 'የማመልከቻዎን ሁኔታ እና የዳይሬክተሩን ምላሽ ለማየት የወላጅዎን ኢሜይል ያስገቡ።'}</p>
                      
                      <form onSubmit={handleCheckStatus} className="flex gap-2">
                        <input 
                          type="email" 
                          value={statusSearchEmail}
                          onChange={(e) => setStatusSearchEmail(e.target.value)}
                          placeholder={lang === 'en' ? 'Guardian Email' : 'የወላጅ ኢሜይል'}
                          className="flex-grow bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white/20 transition-all placeholder:text-blue-200"
                          required
                        />
                        <button 
                          type="submit"
                          disabled={isSearchingStatus}
                          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all disabled:opacity-50"
                        >
                          {isSearchingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'en' ? 'Check' : 'አረጋግጥ')}
                        </button>
                      </form>

                      {statusSearchError && (
                        <p className="mt-4 text-red-200 text-xs font-bold">{statusSearchError}</p>
                      )}

                      {foundAdmissions.length > 0 && (
                        <div className="mt-8 space-y-4">
                          {foundAdmissions.map((app) => (
                            <div key={app.id} className="bg-white/10 rounded-2xl p-4 border border-white/10">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white">{app.studentName}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  app.status === 'Approved' ? 'bg-emerald-400/20 text-emerald-300' :
                                  app.status === 'Rejected' ? 'bg-red-400/20 text-red-300' :
                                  'bg-amber-400/20 text-amber-300'
                                }`}>
                                  {app.status || (lang === 'en' ? 'Pending' : 'በመጠባበቅ ላይ')}
                                </span>
                              </div>
                              <p className="text-xs text-blue-100 mb-3">{lang === 'en' ? 'Grade' : 'ክፍል'}: {app.grade}</p>
                              
                              {app.reply && (
                                <div className="mt-2 p-3 bg-white/10 rounded-xl border border-white/10">
                                  <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">{lang === 'en' ? 'Director Reply' : 'የዳይሬክተር ምላሽ'}</p>
                                  <p className="text-xs italic text-white">"{app.reply}"</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Right Column: Form */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 md:p-12 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    {isSubmitted ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center py-20"
                      >
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
                          <Send className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">{t.admissions.success}</h2>
                        <p className="text-slate-600 mb-8">
                          {t.admissions.successMsg}
                        </p>
                        <button 
                          onClick={() => setIsSubmitted(false)}
                          className="text-blue-600 font-bold hover:underline"
                        >
                          {t.admissions.submitAnother}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="form">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">{t.admissions.formTitle}</h2>
                        <p className="text-slate-500 mb-10">{t.admissions.subtitle}</p>

                        <form onSubmit={handleAdmissionSubmit} className="space-y-6">
                          {/* Student Info */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">{t.admissions.formSectionStudent}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.studentName}</label>
                                <input 
                                  type="text" 
                                  value={admissionForm.studentName}
                                  onChange={(e) => setAdmissionForm({...admissionForm, studentName: e.target.value})}
                                  placeholder={t.admissions.placeholderName}
                                  className={`w-full bg-slate-50 border ${formErrors.studentName ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                />
                                {formErrors.studentName && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.studentName}</p>}
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.gradeApplying}</label>
                                <select 
                                  value={admissionForm.grade}
                                  onChange={(e) => setAdmissionForm({...admissionForm, grade: e.target.value})}
                                  className={`w-full bg-slate-50 border ${formErrors.grade ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                >
                                  <option value="">{t.admissions.placeholderGrade}</option>
                                  {['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                                {formErrors.grade && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.grade}</p>}
                              </div>
                            </div>
                          </div>

                          {/* Guardian Info */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">{t.admissions.formSectionGuardian}</h3>
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.guardianName}</label>
                                <input 
                                  type="text" 
                                  value={admissionForm.guardianName}
                                  onChange={(e) => setAdmissionForm({...admissionForm, guardianName: e.target.value})}
                                  placeholder={t.admissions.placeholderGuardian}
                                  className={`w-full bg-slate-50 border ${formErrors.guardianName ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                />
                                {formErrors.guardianName && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.guardianName}</p>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.guardianPhone}</label>
                                  <input 
                                    type="tel" 
                                    value={admissionForm.guardianPhone}
                                    onChange={(e) => setAdmissionForm({...admissionForm, guardianPhone: e.target.value})}
                                    placeholder={t.admissions.placeholderPhone}
                                    className={`w-full bg-slate-50 border ${formErrors.guardianPhone ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                  />
                                  {formErrors.guardianPhone && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.guardianPhone}</p>}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.guardianEmail}</label>
                                  <input 
                                    type="email" 
                                    value={admissionForm.guardianEmail}
                                    onChange={(e) => setAdmissionForm({...admissionForm, guardianEmail: e.target.value})}
                                    placeholder={t.admissions.placeholderEmail}
                                    className={`w-full bg-slate-50 border ${formErrors.guardianEmail ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                  />
                                  {formErrors.guardianEmail && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.guardianEmail}</p>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Previous School Info */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">{t.admissions.formSectionAcademic}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.previousSchool}</label>
                                <input 
                                  type="text" 
                                  value={admissionForm.previousSchool}
                                  onChange={(e) => setAdmissionForm({...admissionForm, previousSchool: e.target.value})}
                                  placeholder={t.admissions.placeholderSchool}
                                  className={`w-full bg-slate-50 border ${formErrors.previousSchool ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                />
                                {formErrors.previousSchool && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.previousSchool}</p>}
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 ml-1">{t.admissions.lastGrade}</label>
                                <input 
                                  type="text" 
                                  value={admissionForm.lastGrade}
                                  onChange={(e) => setAdmissionForm({...admissionForm, lastGrade: e.target.value})}
                                  placeholder={t.admissions.placeholderLastGrade}
                                  className={`w-full bg-slate-50 border ${formErrors.lastGrade ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3.5 text-sm outline-none focus:border-blue-500 transition-all`}
                                />
                                {formErrors.lastGrade && <p className="text-red-500 text-[10px] font-bold ml-1">{formErrors.lastGrade}</p>}
                              </div>
                            </div>
                          </div>

                          <button 
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200 mt-4"
                          >
                            {t.admissions.submit}
                          </button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
          </section>
        );
      case 'Academics':
        const filteredImages = galleryFilter === 'All' 
          ? galleryImages 
          : galleryImages.filter(img => img.category === galleryFilter);

        return (
          <section className="py-24 bg-white min-h-[60vh]">
            <div className="container mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-4xl mx-auto mb-20"
                >
                  <h1 className="text-5xl md:text-6xl font-bold text-[#0f172a] mb-8">{t.nav.academics}</h1>
                  <p className="text-xl text-slate-600 leading-relaxed">
                    {lang === 'en' 
                      ? 'Our rigorous academic programs are designed to challenge and inspire. Explore our curriculum, world-class facilities, and vibrant student life.'
                      : 'የእኛ ጥብቅ የትምህርት ፕሮግራሞች ተማሪዎችን ለመፈተን እና ለማነሳሳት የተነደፉ ናቸው። ስርአተ ትምህርታችንን፣ አለም አቀፍ ደረጃቸውን የጠበቁ መገልገያዎቻችንን እና ደማቅ የተማሪ ህይወታችንን ያስሱ።'}
                  </p>
                </motion.div>

                {/* Gallery Section */}
                <div className="mt-20">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Campus Gallery' : 'የግቢው ጋለሪ'}</h2>
                      <p className="text-slate-500">{lang === 'en' ? 'Take a look at our facilities and student activities.' : 'መገልገያዎቻችንን እና የተማሪዎችን እንቅስቃሴ ይመልከቱ።'}</p>
                    </div>
                    
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start">
                      {(['All', 'Facility', 'Activity'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setGalleryFilter(filter)}
                          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            galleryFilter === filter 
                              ? 'bg-white text-blue-600 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {filter === 'All' 
                            ? t.dashboard.viewAll
                            : (lang === 'en' ? filter + 's' : (filter === 'Facility' ? 'መገልገያዎች' : 'እንቅስቃሴዎች'))}
                        </button>
                      ))}
                    </div>
                  </div>

                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredImages.map((image) => (
                      <motion.div
                        key={image.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => setSelectedGalleryImage(image)}
                        className="group relative aspect-square rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all"
                      >
                        <img 
                          src={image.url} 
                          alt={image.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                          <span className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">{image.category}</span>
                          <h4 className="text-white font-bold text-lg leading-tight mb-4">{image.title}</h4>
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                            <Maximize2 className="w-5 h-5" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
              {selectedGalleryImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedGalleryImage(null)}
                    className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-6xl aspect-video md:aspect-auto md:max-h-full bg-black rounded-3xl overflow-hidden shadow-2xl"
                  >
                    <button 
                      onClick={() => setSelectedGalleryImage(null)}
                      className="absolute top-6 right-6 z-10 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    
                    <img 
                      src={selectedGalleryImage.url} 
                      alt={selectedGalleryImage.title} 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    
                    <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 bg-gradient-to-t from-black/80 to-transparent">
                      <span className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-2 block">{selectedGalleryImage.category}</span>
                      <h3 className="text-white text-2xl md:text-4xl font-bold">{selectedGalleryImage.title}</h3>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </section>
        );
      case 'Faculty':
        return (
          <section className="py-24 bg-white min-h-[60vh]">
            <div className="container mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-3xl mx-auto mb-20"
                >
                  <h1 className="text-5xl md:text-6xl font-bold text-[#0f172a] mb-8">{t.nav.faculty}</h1>
                  <p className="text-xl text-slate-600 leading-relaxed">
                    {lang === 'en' 
                      ? 'Meet the dedicated teachers and staff who nurture and guide our students every day.'
                      : 'ተማሪዎቻችንን በየቀኑ የሚንከባከቡትን እና የሚመሩትን ታታሪ መምህራን እና ሰራተኞችን ያግኙ።'}
                  </p>
                </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {facultyMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    whileHover={{ y: -10 }}
                    onClick={() => setSelectedFaculty(member)}
                    className="group cursor-pointer bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all"
                  >
                    <div className="aspect-[4/5] overflow-hidden relative">
                      <img 
                        src={member.photo} 
                        alt={member.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                        <span className="text-white text-sm font-semibold flex items-center gap-2">
                          View Bio <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{member.name}</h3>
                      <p className="text-blue-600 font-medium text-sm">{member.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Faculty Bio Modal */}
            <AnimatePresence>
              {selectedFaculty && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedFaculty(null)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] overflow-y-auto"
                  >
                    <button 
                      onClick={() => setSelectedFaculty(null)}
                      className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-900 hover:bg-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <div className="w-full md:w-2/5 aspect-[4/5] md:aspect-auto">
                      <img 
                        src={selectedFaculty.photo} 
                        alt={selectedFaculty.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <div className="p-8 md:p-10 flex-1 flex flex-col justify-center">
                      <span className="text-blue-600 font-bold text-sm uppercase tracking-wider mb-2">{lang === 'en' ? 'Faculty Profile' : 'የመምህር መገለጫ'}</span>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedFaculty.name}</h2>
                      <p className="text-lg font-medium text-slate-500 mb-6">{selectedFaculty.title}</p>
                      <div className="w-12 h-1 bg-blue-600 mb-6 rounded-full" />
                      <p className="text-slate-600 leading-relaxed italic">
                        "{selectedFaculty.bio}"
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </section>
        );
      case 'Blog':
        return (
          <section className="py-24 bg-slate-50 min-h-[60vh]">
            <div className="container mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-3xl mx-auto mb-20"
                >
                  <h1 className="text-5xl md:text-6xl font-bold text-[#0f172a] mb-8">{t.nav.blog}</h1>
                  <p className="text-xl text-slate-600 leading-relaxed">
                    {lang === 'en' 
                      ? 'Insights, stories, and updates from our students, faculty, and leadership.'
                      : 'ከተማሪዎቻችን፣ ከመምህራኖቻችን እና ከአመራራችን የተገኙ ግንዛቤዎች፣ ታሪኮች እና ዝመናዎች።'}
                  </p>
                </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {blogPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    whileHover={{ y: -10 }}
                    className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col"
                  >
                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                      <img 
                        src={post.image || `https://picsum.photos/seed/${post.id}/800/450`} 
                        alt={post.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {post.author}
                      </div>
                    </div>
                    <div className="p-8 flex-grow flex flex-col">
                      <div className="text-slate-400 text-xs font-bold mb-3 flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        {new Date(post.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 leading-tight">{post.title}</h3>
                      <p className="text-slate-600 text-sm line-clamp-3 mb-6 flex-grow">
                        {post.content}
                      </p>
                      <button 
                        onClick={() => setSelectedContent({ title: post.title, content: post.content, date: post.date, image: post.image || `https://picsum.photos/seed/${post.id}/800/450` })}
                        className="text-blue-600 font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all"
                      >
                        {t.home.readMore} <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      case 'Events':
        return (
          <section className="py-24 bg-slate-50 min-h-[60vh]">
            <div className="container mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-3xl mx-auto mb-16"
                >
                  <h1 className="text-5xl md:text-6xl font-bold text-[#0f172a] mb-8">{t.nav.events}</h1>
                  <p className="text-xl text-slate-600 leading-relaxed">
                    {lang === 'en' 
                      ? 'Stay updated with our school\'s vibrant calendar. Join us for academic, sporting, and cultural celebrations.'
                      : 'በትምህርት ቤታችን ደማቅ የቀን መቁጠሪያ ወቅታዊ መረጃ ያግኙ። ለትምህርታዊ፣ ስፖርታዊ እና ባህላዊ በዓላት ይቀላቀሉን።'}
                  </p>
                </motion.div>

                <div className="max-w-5xl mx-auto">
                  {renderCalendar()}
                </div>

                {/* Upcoming Events List */}
                <div className="max-w-5xl mx-auto mt-20">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-3xl font-bold text-slate-900">
                      {lang === 'en' ? 'Upcoming Events' : 'የሚመጡ ኩነቶች'}
                    </h3>
                    <div className="h-1 w-20 bg-blue-600 rounded-full"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events
                      .filter(event => {
                        const eventDate = new Date(event.date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return eventDate >= today && (eventCategoryFilter === 'All' || event.category === eventCategoryFilter);
                      })
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .slice(0, 6)
                      .map(event => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              event.category === 'Academic' ? 'bg-blue-100 text-blue-700' :
                              event.category === 'Sports' ? 'bg-emerald-100 text-emerald-700' :
                              event.category === 'Holiday' ? 'bg-amber-100 text-amber-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {event.category}
                            </div>
                            {registeredEventIds.includes(event.id) && (
                              <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">
                                <CheckCircle className="w-3 h-3" />
                                {lang === 'en' ? 'Registered' : 'ተመዝግበዋል'}
                              </span>
                            )}
                          </div>
                          
                          <h4 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{event.title}</h4>
                          
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <MapPin className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setSelectedEvent(event)}
                              className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors"
                            >
                              {t.common.readMore}
                            </button>
                            <button 
                              onClick={() => handleRegisterEvent(event.id)}
                              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                registeredEventIds.includes(event.id)
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                              }`}
                            >
                              {registeredEventIds.includes(event.id) ? (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  {t.eventModal.unregister}
                                </>
                              ) : (
                                t.eventModal.register
                              )}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-12 flex flex-wrap justify-center gap-6">
                  {[
                    { label: lang === 'en' ? 'Academic' : 'ትምህርታዊ', color: 'bg-blue-100 text-blue-700 border-blue-500' },
                    { label: lang === 'en' ? 'Sports' : 'ስፖርታዊ', color: 'bg-emerald-100 text-emerald-700 border-emerald-500' },
                    { label: lang === 'en' ? 'Social' : 'ማህበራዊ', color: 'bg-purple-100 text-purple-700 border-purple-500' },
                    { label: lang === 'en' ? 'Holiday' : 'በዓል', color: 'bg-amber-100 text-amber-700 border-amber-500' }
                  ].map(cat => (
                  <div key={cat.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${cat.color.split(' ')[0]}`} />
                    <span className="text-sm font-medium text-slate-600">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Details Modal */}
            <AnimatePresence>
              {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedEvent(null)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10 max-h-[90vh] overflow-y-auto"
                  >
                    <button 
                      onClick={() => setSelectedEvent(null)}
                      className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          selectedEvent.category === 'Academic' ? 'bg-blue-100 text-blue-700' :
                          selectedEvent.category === 'Sports' ? 'bg-emerald-100 text-emerald-700' :
                          selectedEvent.category === 'Holiday' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {selectedEvent.category}
                        </span>
                        {registeredEventIds.includes(selectedEvent.id) && (
                          <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {lang === 'en' ? 'Registered' : 'ተመዝግበዋል'}
                          </span>
                        )}
                      </div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-4">{selectedEvent.title}</h2>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium">{new Date(selectedEvent.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', { dateStyle: 'full' })}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium">{selectedEvent.time}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium">{selectedEvent.location}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium">
                            {getRegistrationCount(selectedEvent.id)} {t.eventModal.registeredStudents}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-slate-100 mb-8" />
                    
                    <p className="text-slate-600 leading-relaxed">
                      {selectedEvent.description}
                    </p>
                    
                    {registrationSuccess ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-10 bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center"
                      >
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <h4 className="text-emerald-900 font-bold mb-1">{t.eventModal.success}</h4>
                        <p className="text-emerald-700 text-sm">{t.eventModal.successMsg}</p>
                      </motion.div>
                    ) : (
                      <div className="flex flex-col gap-4 mt-10">
                        {!isLoggedIn ? (
                          <button 
                            onClick={() => {
                              setSelectedEvent(null);
                              setIsLoginModalOpen(true);
                            }}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                          >
                            <Lock className="w-5 h-5" />
                            {lang === 'en' ? 'Login to Register' : 'ለመመዝገብ ይግቡ'}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleRegisterEvent(selectedEvent.id)}
                            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                              registeredEventIds.includes(selectedEvent.id)
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 shadow-none'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                            }`}
                          >
                            {registeredEventIds.includes(selectedEvent.id) && <CheckCircle className="w-5 h-5" />}
                            {registeredEventIds.includes(selectedEvent.id) ? t.eventModal.unregister : t.eventModal.register}
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedEvent(null)}
                          className="w-full py-4 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                        >
                          {t.eventModal.closeDetails}
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </section>
        );
      case 'Contact':
        return (
          <section className="bg-slate-50 min-h-screen">
            {/* Hero Section */}
            <div className="bg-[#0f172a] py-24 px-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 max-w-4xl mx-auto"
              >
                <span className="inline-block px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold tracking-widest uppercase mb-6 border border-blue-500/20">
                  {lang === 'en' ? 'CONTACT US' : 'ያግኙን'}
                </span>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
                  {t.contactPage.heroTitle}
                </h1>
                <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
                  {t.contactPage.heroSubtitle}
                </p>
              </motion.div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-24">
              <div className="grid lg:grid-cols-2 gap-16">
                {/* Contact Info */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-12"
                >
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">{t.contactPage.infoTitle}</h2>
                    <p className="text-slate-600">{t.contactPage.infoSubtitle}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-8">
                    {[
                      { icon: MapPin, title: t.contactPage.addressTitle, value: t.contactPage.addressValue, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { icon: Phone, title: t.contactPage.phoneTitle, value: t.contactPage.phoneValue, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { icon: Mail, title: t.contactPage.emailTitle, value: t.contactPage.emailValue, color: 'text-purple-600', bg: 'bg-purple-50' },
                      { icon: Clock, title: t.contactPage.hoursTitle, value: t.contactPage.hoursValue, color: 'text-orange-600', bg: 'bg-orange-50' }
                    ].map((item, i) => (
                      <div key={i} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-xl flex items-center justify-center mb-4`}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Map Placeholder */}
                  <div className="relative rounded-3xl overflow-hidden h-80 border border-slate-200 shadow-inner group">
                    <img 
                      src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop" 
                      alt="Map" 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-blue-600/10 pointer-events-none"></div>
                    <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'VISIT OUR CAMPUS' : 'ትምህርት ቤታችንን ይጎብኙ'}</p>
                          <p className="text-sm font-bold text-slate-900">{t.contactPage.addressValue}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Contact Form */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                  
                  <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{t.contactPage.formTitle}</h2>
                    <p className="text-slate-500 mb-10">{t.contactPage.formSubtitle}</p>

                    {isContactSubmitted ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center"
                      >
                        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-900 mb-2">{t.contactPage.successTitle}</h3>
                        <p className="text-emerald-700">{t.contactPage.successMessage}</p>
                        <button 
                          onClick={() => setIsContactSubmitted(false)}
                          className="mt-8 text-emerald-600 font-bold hover:underline"
                        >
                          {lang === 'en' ? 'Send another message' : 'ሌላ መልዕክት ይላኩ'}
                        </button>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">{t.contactPage.nameLabel}</label>
                            <input 
                              type="text"
                              value={contactForm.name}
                              onChange={(e) => {
                                setContactForm({ ...contactForm, name: e.target.value });
                                if (contactErrors.name) setContactErrors(prev => {
                                  const next = { ...prev };
                                  delete next.name;
                                  return next;
                                });
                              }}
                              className={`w-full bg-slate-50 border ${contactErrors.name ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'} rounded-xl px-4 py-4 text-sm outline-none transition-all`}
                              placeholder="John Doe"
                            />
                            {contactErrors.name && <p className="text-xs text-red-500 font-medium ml-1">{contactErrors.name}</p>}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">{t.contactPage.emailLabel}</label>
                            <input 
                              type="email"
                              value={contactForm.email}
                              onChange={(e) => {
                                setContactForm({ ...contactForm, email: e.target.value });
                                if (contactErrors.email) setContactErrors(prev => {
                                  const next = { ...prev };
                                  delete next.email;
                                  return next;
                                });
                              }}
                              className={`w-full bg-slate-50 border ${contactErrors.email ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'} rounded-xl px-4 py-4 text-sm outline-none transition-all`}
                              placeholder="john@example.com"
                            />
                            {contactErrors.email && <p className="text-xs text-red-500 font-medium ml-1">{contactErrors.email}</p>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 ml-1">{t.contactPage.subjectLabel}</label>
                          <input 
                            type="text"
                            value={contactForm.subject}
                            onChange={(e) => {
                              setContactForm({ ...contactForm, subject: e.target.value });
                              if (contactErrors.subject) setContactErrors(prev => {
                                const next = { ...prev };
                                delete next.subject;
                                return next;
                              });
                            }}
                            className={`w-full bg-slate-50 border ${contactErrors.subject ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'} rounded-xl px-4 py-4 text-sm outline-none transition-all`}
                            placeholder={lang === 'en' ? "How can we help?" : "እንዴት ልንረዳዎ እንችላለን?"}
                          />
                          {contactErrors.subject && <p className="text-xs text-red-500 font-medium ml-1">{contactErrors.subject}</p>}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 ml-1">{t.contactPage.messageLabel}</label>
                          <textarea 
                            rows={5}
                            value={contactForm.message}
                            onChange={(e) => {
                              setContactForm({ ...contactForm, message: e.target.value });
                              if (contactErrors.message) setContactErrors(prev => {
                                const next = { ...prev };
                                delete next.message;
                                return next;
                              });
                            }}
                            className={`w-full bg-slate-50 border ${contactErrors.message ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'} rounded-xl px-4 py-4 text-sm outline-none transition-all resize-none`}
                            placeholder={lang === 'en' ? "Write your message here..." : "መልዕክትዎን እዚህ ይጻፉ..."}
                          />
                          {contactErrors.message && <p className="text-xs text-red-500 font-medium ml-1">{contactErrors.message}</p>}
                        </div>

                        <button 
                          type="submit"
                          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
                        >
                          {t.contactPage.submitButton}
                          <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>
                      </form>
                    )}

                    <div className="mt-12 pt-12 border-t border-slate-100">
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                          <LifeBuoy className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{t.contactPage.supportTitle}</h4>
                          <p className="text-xs text-slate-500">{t.contactPage.supportDesc}</p>
                        </div>
                        <button className="ml-auto text-blue-600 font-bold text-sm hover:underline">
                          {lang === 'en' ? 'Contact Support' : 'ድጋፍ ያግኙ'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        );
      case 'Dashboard':
        return (
          <section className="py-24 bg-slate-50 min-h-[80vh]">
            <div className="container mx-auto px-6">
              {!isEmailVerified && !isSimulatedSession && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12 p-6 bg-white border-l-4 border-amber-500 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-amber-100/50 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-50" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0 animate-pulse">
                      <AlertCircle className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{lang === 'en' ? 'Verify Your Email Address' : 'ኢሜይልዎን ያረጋግጡ'}</h3>
                      <p className="text-slate-600 text-sm max-w-md">
                        {lang === 'en' 
                          ? "We've sent a verification link to your email. Please check your inbox to activate all portal features." 
                          : "የማረጋገጫ ሊንክ ወደ ኢሜይልዎ ልከናል። ሁሉንም የፖርታል ባህሪያት ለማንቃት እባክዎ የኢሜይል ሳጥንዎን ያረጋግጡ።"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 relative z-10">
                    <button 
                      disabled={isCheckingVerification}
                      onClick={async () => {
                        if (auth.currentUser) {
                          setIsCheckingVerification(true);
                          try {
                            await auth.currentUser.reload();
                            setIsEmailVerified(auth.currentUser.emailVerified);
                            if (auth.currentUser.emailVerified) {
                              alert(lang === 'en' ? 'Email successfully verified!' : 'ኢሜይል በተሳካ ሁኔታ ተረጋግጧል!');
                            } else {
                              alert(lang === 'en' ? 'Email still not verified. Please check your inbox.' : 'ኢሜይል ገና አልተረጋገጠም። እባክዎ የኢሜይል ሳጥንዎን ያረጋግጡ።');
                            }
                          } catch (error) {
                            console.error('Error checking verification status:', error);
                            alert(lang === 'en' ? 'Error checking status. Please try again.' : 'ሁኔታውን በማረጋገጥ ላይ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።');
                          } finally {
                            setIsCheckingVerification(false);
                          }
                        }
                      }}
                      className="px-5 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isCheckingVerification ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {lang === 'en' ? 'Check Status' : 'ሁኔታውን አረጋግጥ'}
                    </button>
                    <button 
                      disabled={isResendingEmail}
                      onClick={async () => {
                        if (auth.currentUser) {
                          setIsResendingEmail(true);
                          try {
                            await sendEmailVerification(auth.currentUser);
                            alert(lang === 'en' ? 'Verification email resent! Please check your inbox (including spam folder).' : 'የማረጋገጫ ኢሜይል እንደገና ተልኳል! እባክዎ የኢሜይል ሳጥንዎን (አይፈለጌ መልዕክትን ጨምሮ) ያረጋግጡ።');
                          } catch (error: any) {
                            console.error('Error resending verification email:', error);
                            if (error.code === 'auth/too-many-requests') {
                              alert(lang === 'en' ? 'Too many requests. Please wait a while before trying again.' : 'ብዙ ሙከራዎች ተደርገዋል። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።');
                            } else {
                              alert(lang === 'en' ? 'Error resending email. Please try again later.' : 'ኢሜይል በመላክ ላይ ስህተት ተከስቷል። እባክዎ ቆይተው እንደገና ይሞክሩ።');
                            }
                          } finally {
                            setIsResendingEmail(false);
                          }
                        }
                      }}
                      className="px-5 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isResendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {lang === 'en' ? 'Resend Verification Email' : 'የማረጋገጫ ኢሜይል እንደገና ላክ'}
                    </button>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-[#0f172a] mb-2">{t.dashboard.welcome}, {userData.name}</h1>
                  <p className="text-slate-500 font-medium">
                    {userRole === 'Director' ? t.dashboard.directorTitle : `${userData.grade} • ${t.dashboard.studentId}: ${userData.id}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {userRole === 'Director' && (
                    <button 
                      onClick={() => setIsPosting(true)}
                      className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      <Plus className="w-5 h-5" /> {t.dashboard.createPost}
                    </button>
                  )}
                  {userRole === 'Student' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditProfileData({
                            name: userData.name,
                            grade: userData.grade,
                            photo: userData.photo
                          });
                          setIsEditingProfile(true);
                        }}
                        className="flex-1 sm:flex-none bg-white border border-slate-200 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <Edit3 className="w-5 h-5 text-blue-600" /> {t.dashboard.editProfile}
                      </button>
                      {userData.hasIdCard && (
                        <button 
                          onClick={() => {
                            setViewingIdCard({
                              id: userData.id,
                              name: userData.name,
                              grade: userData.grade,
                              email: userData.email,
                              photo: userData.photo,
                              enrollmentDate: userData.enrollmentDate,
                              hasIdCard: true
                            } as any);
                            setIsViewingIdCard(true);
                          }}
                          className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                        >
                          <Contact className="w-5 h-5" /> {lang === 'en' ? 'My ID Card' : 'የእኔ መታወቂያ'}
                        </button>
                      )}
                    </div>
                  )}
                  <button className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all relative">
                    <Bell className="w-6 h-6 text-slate-600" />
                    <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 sm:flex-none bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                  >
                    <LogOut className="w-5 h-5" /> {t.dashboard.logout}
                  </button>
                </div>
              </motion.div>

              {userRole === 'Director' && (
                <div className="flex flex-wrap gap-2 mb-12 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                  {(['Overview', 'AdminTools', 'Students', 'Gradebook', 'Faculty', 'Calendar', 'News', 'Messages', 'Admissions', 'Payments'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDashboardTab(tab)}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        dashboardTab === tab 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {tab === 'Overview' ? (lang === 'en' ? 'Overview' : 'አጠቃላይ እይታ') :
                       tab === 'AdminTools' ? (lang === 'en' ? 'Admin Tools' : 'የአስተዳደር መሳሪያዎች') :
                       tab === 'Students' ? (lang === 'en' ? 'Students' : 'ተማሪዎች') :
                       tab === 'Gradebook' ? (lang === 'en' ? 'Gradebook' : 'የውጤት መዝገብ') :
                       tab === 'Faculty' ? (lang === 'en' ? 'Faculty' : 'መምህራን') :
                       tab === 'Calendar' ? (lang === 'en' ? 'Calendar' : 'ካላንደር') :
                       tab === 'News' ? (lang === 'en' ? 'News & Blog' : 'ዜና እና ብሎግ') :
                       tab === 'Messages' ? (lang === 'en' ? 'Messages' : 'መልዕክቶች') :
                       tab === 'Admissions' ? (lang === 'en' ? 'Admissions' : 'ምዝገባ') :
                       (lang === 'en' ? 'Payments' : 'ክፍያዎች')}
                    </button>
                  ))}
                </div>
              )}

              {userRole === 'Teacher' && (
                <div className="flex flex-wrap gap-2 mb-12 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                  {(['Overview', 'MyStudents', 'Gradebook', 'Messages'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDashboardTab(tab)}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        dashboardTab === tab 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {tab === 'Overview' ? (lang === 'en' ? 'Overview' : 'አጠቃላይ እይታ') :
                       tab === 'MyStudents' ? (lang === 'en' ? 'My Students' : 'የእኔ ተማሪዎች') :
                       tab === 'Gradebook' ? (lang === 'en' ? 'Gradebook' : 'የውጤት መዝገብ') :
                       (lang === 'en' ? 'Contact Director' : 'ዳይሬክተሩን ያነጋግሩ')}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                  {userRole === 'Director' ? (
                    <>
                      {dashboardTab === 'Overview' && (
                        <>
                          {/* Director Management Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                              { label: t.dashboard.totalStudents, value: students.length.toString(), icon: <Users className="text-blue-600" />, color: 'bg-blue-100' },
                              { label: t.dashboard.staffMembers, value: '85', icon: <Award className="text-emerald-600" />, color: 'bg-emerald-100' },
                              { label: t.dashboard.activeEvents, icon: <CalendarIcon className="text-amber-600" />, color: 'bg-amber-100', value: events.length.toString() }
                            ].map((stat, i) => (
                              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                                  {stat.icon}
                                </div>
                                <p className="text-slate-500 text-sm font-medium mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                              </div>
                            ))}
                          </div>

                          {/* Director Tools Section */}
                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Director Tools' : 'የዳይሬክተር መሳሪያዎች'}</h3>
                                <p className="text-sm text-slate-500">{lang === 'en' ? `Administrative access for ${userData.name}` : `ለ${userData.name} የአስተዳደር መዳረሻ`}</p>
                              </div>
                              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <Shield className="w-6 h-6" />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {[
                                { 
                                  name: lang === 'en' ? 'Student Management' : 'የተማሪዎች አስተዳደር', 
                                  icon: <Users className="w-5 h-5" />, 
                                  desc: lang === 'en' ? 'Manage student profiles and grades' : 'የተማሪዎችን ፕሮፋይልና ውጤት ያስተዳድሩ', 
                                  color: 'text-blue-600', 
                                  bg: 'bg-blue-50', 
                                  action: () => setDashboardTab('Students') 
                                },
                                { 
                                  name: lang === 'en' ? 'Add Student' : 'ተማሪ ጨምር', 
                                  icon: <Plus className="w-5 h-5" />, 
                                  desc: lang === 'en' ? 'Register a new student' : 'አዲስ ተማሪ ይመዝግቡ', 
                                  color: 'text-emerald-600', 
                                  bg: 'bg-emerald-50', 
                                  action: () => { setIsAddingStudent(true); setNewStudent(prev => ({ ...prev, id: generateNextStudentId() })); }
                                },
                                { 
                                  name: lang === 'en' ? 'Manage Academic Calendar' : 'የትምህርት ካላንደር ያስተዳድሩ', 
                                  icon: <CalendarIcon className="w-5 h-5" />, 
                                  desc: lang === 'en' ? 'Schedule terms and holidays' : 'መንፈቅ ዓመታትንና በዓላትን ያቅዱ', 
                                  color: 'text-amber-600', 
                                  bg: 'bg-amber-50', 
                                  action: () => setDashboardTab('Calendar') 
                                }
                              ].map((tool, i) => (
                                <button 
                                  key={i} 
                                  onClick={tool.action}
                                  className="flex items-start gap-4 p-5 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all text-left group"
                                >
                                  <div className={`w-12 h-12 ${tool.bg} ${tool.color} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                    {tool.icon}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{tool.name}</h4>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tool.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {dashboardTab === 'AdminTools' && (
                        <div className="space-y-8">
                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Administrative Control Center' : 'የአስተዳደር ቁጥጥር ማዕከል'}</h3>
                                <p className="text-slate-500">{lang === 'en' ? 'Manage school operations and academic records' : 'የትምህርት ቤት ስራዎችን እና የትምህርት መዝገቦችን ያስተዳድሩ'}</p>
                              </div>
                              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <Settings className="w-7 h-7" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                              {[
                                { label: lang === 'en' ? 'Total Students' : 'ጠቅላላ ተማሪዎች', value: students.length, color: 'blue' },
                                { label: lang === 'en' ? 'Faculty' : 'መምህራን', value: faculty.length, color: 'emerald' },
                                { label: lang === 'en' ? 'Admissions' : 'ምዝገባ', value: admissions.length, color: 'purple' },
                                { label: lang === 'en' ? 'Events' : 'ዝግጅቶች', value: events.length, color: 'amber' }
                              ].map((stat, i) => (
                                <div key={i} className={`bg-${stat.color}-50/50 border border-${stat.color}-100 p-4 rounded-2xl`}>
                                  <p className={`text-[10px] font-bold text-${stat.color}-600 uppercase tracking-wider mb-1`}>{stat.label}</p>
                                  <p className="text-xl font-black text-slate-800">{stat.value}</p>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {[
                                { 
                                  title: lang === 'en' ? 'Student Records' : 'የተማሪዎች መዝገብ', 
                                  icon: <Users className="w-6 h-6" />, 
                                  count: students.length, 
                                  desc: lang === 'en' ? 'Add, edit, and manage student profiles' : 'የተማሪዎችን ፕሮፋይል ይጨምሩ፣ ያስተካክሉ እና ያስተዳድሩ',
                                  tab: 'Students',
                                  color: 'blue'
                                },
                                { 
                                  title: lang === 'en' ? 'Faculty Profiles' : 'የመምህራን ፕሮፋይሎች', 
                                  icon: <Award className="w-6 h-6" />, 
                                  count: faculty.length, 
                                  desc: lang === 'en' ? 'Manage teaching staff and assignments' : 'የማስተማር ሰራተኞችን እና ስራዎችን ያስተዳድሩ',
                                  tab: 'Faculty',
                                  color: 'emerald'
                                },
                                { 
                                  title: lang === 'en' ? 'Academic Calendar' : 'የትምህርት ካላንደር', 
                                  icon: <CalendarIcon className="w-6 h-6" />, 
                                  count: events.length, 
                                  desc: lang === 'en' ? 'Schedule school events and holidays' : 'የትምህርት ቤት ዝግጅቶችን እና በዓላትን ያቅዱ',
                                  tab: 'Calendar',
                                  color: 'amber'
                                },
                                { 
                                  title: lang === 'en' ? 'Admissions' : 'ምዝገባ', 
                                  icon: <ClipboardList className="w-6 h-6" />, 
                                  count: admissions.length, 
                                  desc: lang === 'en' ? 'Review and process new student applications' : 'አዲስ የተማሪ ማመልከቻዎችን ይገምግሙ እና ያካሂዱ',
                                  tab: 'Admissions',
                                  color: 'purple'
                                },
                                { 
                                  title: lang === 'en' ? 'Gradebook' : 'የውጤት መዝገብ', 
                                  icon: <GraduationCap className="w-6 h-6" />, 
                                  count: 'Active', 
                                  desc: lang === 'en' ? 'Monitor and manage academic performance' : 'የትምህርት አፈፃፀምን ይቆጣጠሩ እና ያስተዳድሩ',
                                  tab: 'Gradebook',
                                  color: 'rose'
                                },
                                { 
                                  title: lang === 'en' ? 'Messages' : 'መልዕክቶች', 
                                  icon: <MessageSquare className="w-6 h-6" />, 
                                  count: 'New', 
                                  desc: lang === 'en' ? 'Communicate with students and parents' : 'ከተማሪዎች እና ወላጆች ጋር ይገናኙ',
                                  tab: 'Messages',
                                  color: 'indigo'
                                }
                              ].map((tool, i) => (
                                <button 
                                  key={i} 
                                  onClick={() => setDashboardTab(tool.tab as any)}
                                  className="group p-6 rounded-3xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left bg-slate-50/50"
                                >
                                  <div className={`w-12 h-12 bg-${tool.color}-100 text-${tool.color}-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    {tool.icon}
                                  </div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{tool.title}</h4>
                                    <span className={`bg-${tool.color}-100 text-${tool.color}-700 text-xs font-bold px-2.5 py-1 rounded-full`}>{tool.count}</span>
                                  </div>
                                  <p className="text-sm text-slate-500 leading-relaxed mb-6">{tool.desc}</p>
                                  <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                                    {lang === 'en' ? 'Open Management Tool' : 'የአስተዳደር መሣሪያውን ይክፈቱ'}
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick Actions Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-600" />
                                {lang === 'en' ? 'Quick Registration' : 'ፈጣን ምዝገባ'}
                              </h3>
                              <div className="space-y-4">
                                <button 
                                  onClick={() => { setIsAddingStudent(true); setNewStudent(prev => ({ ...prev, id: generateNextStudentId() })); }}
                                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all group"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                      <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold text-slate-800">{lang === 'en' ? 'Register New Student' : 'አዲስ ተማሪ ይመዝግቡ'}</p>
                                      <p className="text-xs text-slate-500">{lang === 'en' ? 'Add a new student to the database' : 'አዲስ ተማሪ ወደ ዳታቤዝ ይጨምሩ'}</p>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all" />
                                </button>
                                <button 
                                  onClick={() => { setIsAddingFaculty(true); setNewFaculty({ name: '', title: '', bio: '', photo: '', teacherId: generateNextTeacherId() }); }}
                                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all group"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                      <Users className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold text-slate-800">{lang === 'en' ? 'Add Faculty Member' : 'መምህር ይጨምሩ'}</p>
                                      <p className="text-xs text-slate-500">{lang === 'en' ? 'Create a new teacher profile' : 'አዲስ የመምህር ፕሮፋይል ይፍጠሩ'}</p>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 transition-all" />
                                </button>
                                <button 
                                  onClick={() => { setEditingEvent(null); setNewEventForm({ title: '', date: '', time: '', location: '', description: '', category: 'Academic' }); setIsManagingCalendar(true); }}
                                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all group"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                      <CalendarIcon className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold text-slate-800">{lang === 'en' ? 'Schedule New Event' : 'አዲስ ዝግጅት ያቅዱ'}</p>
                                      <p className="text-xs text-slate-500">{lang === 'en' ? 'Add an event to the academic calendar' : 'በትምህርት ካላንደር ላይ ዝግጅት ይጨምሩ'}</p>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600 transition-all" />
                                </button>
                              </div>
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-600" />
                                {lang === 'en' ? 'Recent Activity' : 'የቅርብ ጊዜ እንቅስቃሴ'}
                              </h3>
                              <div className="space-y-6">
                                {[
                                  { action: lang === 'en' ? 'New Admission' : 'አዲስ ምዝገባ', time: '2 hours ago', user: 'Abebe Kebede', color: 'blue' },
                                  { action: lang === 'en' ? 'Grade Posted' : 'ውጤት ተለጥፏል', time: '5 hours ago', user: 'Sara Tadesse', color: 'emerald' },
                                  { action: lang === 'en' ? 'Event Updated' : 'ዝግጅት ተሻሽሏል', time: 'Yesterday', user: 'School Office', color: 'amber' }
                                ].map((activity, i) => (
                                  <div key={i} className="flex items-start gap-4">
                                    <div className={`w-2 h-2 mt-2 rounded-full bg-${activity.color}-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]`}></div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">{activity.action}</p>
                                      <p className="text-xs text-slate-500">{activity.user} • {activity.time}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button className="w-full mt-8 text-blue-600 font-bold text-sm hover:underline">
                                {lang === 'en' ? 'View Full Audit Log' : 'ሙሉውን የኦዲት ሎግ ይመልከቱ'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'News' && (
                        <div className="space-y-8">
                          {/* Director Posts Management */}
                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xl font-bold text-slate-900">{t.dashboard.recentBlog}</h3>
                              <button onClick={() => { setPostType('Blog'); setIsPosting(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {lang === 'en' ? 'New Blog Post' : 'አዲስ የብሎግ ጽሁፍ'}
                              </button>
                            </div>
                            <div className="space-y-4">
                              {blogPosts.map((post) => (
                                <div key={post.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                  <div>
                                    <h4 className="font-bold text-slate-800">{post.title}</h4>
                                    <p className="text-sm text-slate-500">{post.date} • By {post.author}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => setSelectedContent({ title: post.title, content: post.content, date: post.date })}
                                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(lang === 'en' ? 'Are you sure you want to delete this blog post?' : 'ይህን የብሎግ ጽሁፍ ለመሰረዝ እርግጠኛ ነዎት?')) {
                                          try {
                                            await deleteDoc(doc(db, 'blog', post.id));
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.DELETE, `blog/${post.id}`);
                                          }
                                        }
                                      }}
                                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xl font-bold text-slate-900">{t.dashboard.schoolNews}</h3>
                              <button onClick={() => { setPostType('News'); setIsPosting(true); }} className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {lang === 'en' ? 'New News Item' : 'አዲስ የዜና መረጃ'}
                              </button>
                            </div>
                            <div className="space-y-4">
                              {newsItems.map((news) => (
                                <div key={news.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                      <Newspaper className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-slate-800">{news.title}</h4>
                                      <p className="text-sm text-slate-500">{news.date}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => setSelectedContent({ title: news.title, content: news.content, date: news.date, image: news.image })}
                                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(lang === 'en' ? 'Are you sure you want to delete this news item?' : 'ይህን የዜና መረጃ ለመሰረዝ እርግጠኛ ነዎት?')) {
                                          try {
                                            await deleteDoc(doc(db, 'news', news.id));
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.DELETE, `news/${news.id}`);
                                          }
                                        }
                                      }}
                                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'Students' && (
                        /* Student Management */
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">{t.dashboard.studentManagement}</h3>
                            <p className="text-sm text-slate-500">{t.dashboard.studentManagementDesc}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 md:w-64">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="text"
                                placeholder={lang === 'en' ? 'Search by name or email...' : 'በስም ወይም በኢሜይል ይፈልጉ...'}
                                value={studentSearchQuery}
                                onChange={(e) => setStudentSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                              />
                            </div>
                            <div className="relative flex-1 md:w-48">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="text"
                                placeholder={lang === 'en' ? 'Search by ID...' : 'በመታወቂያ ይፈልጉ...'}
                                value={studentIdSearchQuery}
                                onChange={(e) => setStudentIdSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                              />
                            </div>
                            <div className="relative">
                              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <select 
                                value={studentGradeFilter}
                                onChange={(e) => setStudentGradeFilter(e.target.value)}
                                className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 appearance-none cursor-pointer transition-all"
                              >
                                <option value="All">{t.dashboard.filterAll}</option>
                                <option value="9th Grade">{lang === 'en' ? '9th Grade' : '9ኛ ክፍል'}</option>
                                <option value="10th Grade">{lang === 'en' ? '10th Grade' : '10ኛ ክፍል'}</option>
                                <option value="11th Grade">{lang === 'en' ? '11th Grade' : '11ኛ ክፍል'}</option>
                                <option value="12th Grade">{lang === 'en' ? '12th Grade' : '12ኛ ክፍል'}</option>
                              </select>
                            </div>
                            <div className="relative">
                              <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <select 
                                value={studentSortOrder}
                                onChange={(e) => setStudentSortOrder(e.target.value as any)}
                                className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 appearance-none cursor-pointer transition-all"
                              >
                                <option value="Asc">{t.dashboard.sortAsc}</option>
                                <option value="Desc">{t.dashboard.sortDesc}</option>
                                <option value="GradeAsc">{t.dashboard.sortGradeAsc}</option>
                                <option value="GradeDesc">{t.dashboard.sortGradeDesc}</option>
                              </select>
                            </div>
                            <button 
                              onClick={() => {
                                setIsAddingStudent(true);
                                setNewStudent(prev => ({ ...prev, id: generateNextStudentId() }));
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all text-sm"
                            >
                              <Plus className="w-4 h-4" /> {t.dashboard.addStudent}
                            </button>

                            <div className="flex bg-slate-100 p-1 rounded-xl">
                              <button 
                                onClick={() => setStudentViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-all ${studentViewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title={lang === 'en' ? 'Grid View' : 'የፍርግርግ እይታ'}
                              >
                                <LayoutGrid className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setStudentViewMode('table')}
                                className={`p-1.5 rounded-lg transition-all ${studentViewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title={lang === 'en' ? 'Table View' : 'የሰንጠረዥ እይታ'}
                              >
                                <List className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {currentStudents.length > 0 ? (
                          studentViewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentStudents.map((student) => (
                              <motion.div 
                                layout
                                key={student.id}
                                className="group bg-slate-50/50 border border-slate-100 rounded-2xl p-6 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all"
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-4">
                                    <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                    <div>
                                      <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{student.name}</h4>
                                      <p className="text-xs text-slate-500 font-mono"><span className="font-bold text-slate-400 mr-1">{t.dashboard.studentId}:</span> {student.id}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => {
                                        setEditingStudent(student);
                                        setIsEditingStudent(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setMessagingStudent(student);
                                        setIsMessagingStudent(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title={t.dashboard.sendMessage}
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: lang === 'en' ? 'Delete Student' : 'ተማሪ ይሰርዙ',
                                          message: lang === 'en' ? `Are you sure you want to delete ${student.name}?` : `${student.name}ን ለመሰረዝ እርግጠኛ ነዎት?`,
                                          type: 'danger',
                                          onConfirm: async () => {
                                            try {
                                              await deleteDoc(doc(db, 'students', student.id));
                                              setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                            } catch (error) {
                                              handleFirestoreError(error, OperationType.DELETE, `students/${student.id}`);
                                            }
                                          }
                                        });
                                      }}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">{t.dashboard.grade}</span>
                                    <span className="font-medium text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-100">{student.grade}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">{lang === 'en' ? 'Email' : 'ኢሜል'}</span>
                                    <span className="text-slate-600 truncate max-w-[150px]">{student.email}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">{t.dashboard.enrolled}</span>
                                    <span className="text-slate-600">{student.enrollmentDate}</span>
                                  </div>
                                  <button 
                                    onClick={() => setViewingStudentGrades(student.id)}
                                    className="w-full mt-4 bg-emerald-50 text-emerald-600 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                                  >
                                    <GraduationCap className="w-4 h-4" /> {lang === 'en' ? 'View Academic Performance' : 'የትምህርት አፈጻጸም ይመልከቱ'}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setPostingGradeStudent(student);
                                      setIsPostingGrade(true);
                                    }}
                                    className="w-full mt-2 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Plus className="w-4 h-4" /> {t.dashboard.postGrade}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setViewingIdCard(student);
                                      setIsViewingIdCard(true);
                                    }}
                                    className={`w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${student.hasIdCard ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                  >
                                    <Contact className="w-4 h-4" /> {lang === 'en' ? (student.hasIdCard ? 'View ID Card' : 'Issue ID Card') : (student.hasIdCard ? 'መታወቂያ ይመልከቱ' : 'መታወቂያ ይስጡ')}
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          ) : (
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.tableStudent}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.tableId}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.tableGrade}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'en' ? 'Email' : 'ኢሜል'}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.tableActions}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {currentStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <img src={student.photo} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                          <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{student.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{student.id}</span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="text-sm text-slate-600">{student.grade}</span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="text-sm text-slate-500">{student.email}</span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => setViewingStudentGrades(student.id)}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                            title={lang === 'en' ? 'View Academic Performance' : 'የትምህርት አፈጻጸም ይመልከቱ'}
                                          >
                                            <GraduationCap className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setViewingIdCard(student);
                                              setIsViewingIdCard(true);
                                            }}
                                            className={`p-1.5 rounded-lg transition-all ${student.hasIdCard ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                            title={lang === 'en' ? (student.hasIdCard ? 'View ID Card' : 'Issue ID Card') : (student.hasIdCard ? 'መታወቂያ ይመልከቱ' : 'መታወቂያ ይስጡ')}
                                          >
                                            <Contact className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setEditingStudent(student);
                                              setIsEditingStudent(true);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                          >
                                            <Edit3 className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setMessagingStudent(student);
                                              setIsMessagingStudent(true);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                          >
                                            <MessageSquare className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={async () => {
                                              if (window.confirm(lang === 'en' ? 'Are you sure you want to delete this student?' : 'ይህን ተማሪ ለመሰረዝ እርግጠኛ ነዎት?')) {
                                                try {
                                                  await deleteDoc(doc(db, 'students', student.id));
                                                } catch (error) {
                                                  handleFirestoreError(error, OperationType.DELETE, `students/${student.id}`);
                                                }
                                              }
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        ) : (
                          <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-500">{t.dashboard.noStudents}</p>
                          </div>
                        )}

                        {/* Pagination */}
                        {totalStudentPages > 1 && (
                          <div className="mt-12 flex items-center justify-center gap-4">
                            <button 
                              disabled={studentPage === 1}
                              onClick={() => setStudentPage(p => p - 1)}
                              className="p-2 rounded-xl border border-slate-100 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                              {[...Array(totalStudentPages)].map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => setStudentPage(i + 1)}
                                  className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                                    studentPage === i + 1 
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                                      : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {i + 1}
                                </button>
                              ))}
                            </div>
                            <button 
                              disabled={studentPage === totalStudentPages}
                              onClick={() => setStudentPage(p => p + 1)}
                              className="p-2 rounded-xl border border-slate-100 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      )}

                      {dashboardTab === 'Faculty' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Faculty Management' : 'የመምህራን አስተዳደር'}</h3>
                              <p className="text-sm text-slate-500">{lang === 'en' ? 'Add, edit, and manage school faculty profiles' : 'የመምህራን ፕሮፋይሎችን ይጨምሩ፣ ያስተካክሉ እና ያስተዳድሩ'}</p>
                            </div>
                            <button 
                              onClick={() => {
                                setNewFaculty({ name: '', title: '', bio: '', photo: '', teacherId: generateNextTeacherId() });
                                setIsAddingFaculty(true);
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all text-sm"
                            >
                              <Plus className="w-4 h-4" /> {lang === 'en' ? 'Add Teacher' : 'መምህር ጨምር'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {faculty.map((member) => (
                              <div key={member.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm">
                                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => {
                                        setEditingFaculty(member);
                                        setIsEditingFaculty(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                      title={lang === 'en' ? 'Edit Profile' : 'ፕሮፋይል ያርሙ'}
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setMessagingFaculty(member);
                                        setIsMessagingFaculty(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title={lang === 'en' ? 'Send Message' : 'መልዕክት ላክ'}
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: lang === 'en' ? 'Delete Faculty' : 'መምህር ይሰርዙ',
                                          message: lang === 'en' ? `Are you sure you want to delete ${member.name}?` : `${member.name}ን ለመሰረዝ እርግጠኛ ነዎት?`,
                                          type: 'danger',
                                          onConfirm: () => handleDeleteFaculty(member.id)
                                        });
                                      }}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      title={lang === 'en' ? 'Delete' : 'ሰርዝ'}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <h4 className="font-bold text-slate-900 mb-1">{member.name}</h4>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded-md border border-slate-200">
                                    {member.teacherId}
                                  </span>
                                </div>
                                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">{member.title}</p>
                                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{member.bio}</p>
                              </div>
                            ))}
                            {faculty.length === 0 && (
                              <div className="col-span-full py-12 text-center">
                                <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500">{lang === 'en' ? 'No faculty members added yet' : 'እስካሁን ምንም መምህራን አልተጨመሩም'}</p>
                              </div>
                            )}
                          </div>

                          <div className="mt-16 border-t border-slate-100 pt-12">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Login-enabled Teacher Accounts' : 'የመግቢያ ፍቃድ ያላቸው የመምህራን አካውንቶች'}</h3>
                                <p className="text-sm text-slate-500">{lang === 'en' ? 'Manage teachers who can log in to the portal' : 'ወደ ፖርታሉ መግባት የሚችሉ መምህራንን ያስተዳድሩ'}</p>
                              </div>
                              <button 
                                onClick={() => setIsAddingTeacherAccount(true)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all text-sm"
                              >
                                <Plus className="w-4 h-4" /> {lang === 'en' ? 'Add Login Account' : 'የመግቢያ አካውንት ጨምር'}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {teachers.map((teacher) => (
                                <div key={teacher.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                                  <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                                      <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-slate-900">{teacher.name}</h4>
                                      <p className="text-xs text-blue-600 font-bold">{teacher.subject}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">ID:</span>
                                      <span className="font-bold text-slate-700">{teacher.id}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Email:</span>
                                      <span className="font-bold text-slate-700">{teacher.email}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(lang === 'en' ? 'Delete this teacher account?' : 'ይህን የመምህር አካውንት ልሰርዘው?')) {
                                          try {
                                            await deleteDoc(doc(db, 'teachers', teacher.id));
                                          } catch (error) {
                                            console.error('Error deleting teacher:', error);
                                          }
                                        }
                                      }}
                                      className="text-xs font-bold text-red-600 hover:underline"
                                    >
                                      {lang === 'en' ? 'Remove Access' : 'መዳረሻውን ሰርዝ'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'Calendar' && (
                      /* Academic Calendar Management */
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">{t.dashboard.manageCalendar}</h3>
                            <p className="text-sm text-slate-500">{t.dashboard.manageCalendarDesc}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                              {(['All', 'Academic', 'Sports', 'Social', 'Holiday'] as const).map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setEventCategoryFilter(cat)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                    eventCategoryFilter === cat
                                      ? 'bg-white text-blue-600 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  {cat === 'All' ? (lang === 'en' ? 'All' : 'ሁሉም') :
                                   cat === 'Academic' ? (lang === 'en' ? 'Academic' : 'ትምህርታዊ') :
                                   cat === 'Sports' ? (lang === 'en' ? 'Sports' : 'ስፖርታዊ') :
                                   cat === 'Social' ? (lang === 'en' ? 'Social' : 'ማህበራዊ') :
                                   (lang === 'en' ? 'Holiday' : 'በዓል')}
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => {
                                setEditingEvent(null);
                                setNewEventForm({ title: '', date: '', time: '', location: '', description: '', category: 'Academic' });
                                setIsManagingCalendar(true);
                              }}
                              className="bg-amber-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 transition-all text-sm"
                            >
                              <Plus className="w-4 h-4" /> {t.dashboard.addEvent}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {events
                            .filter(e => eventCategoryFilter === 'All' || e.category === eventCategoryFilter)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map((event) => (
                            <div key={event.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 hover:bg-white hover:shadow-md transition-all">
                              <div className="flex items-start justify-between mb-4">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  event.category === 'Holiday' ? 'bg-red-100 text-red-600' :
                                  event.category === 'Academic' ? 'bg-blue-100 text-blue-600' :
                                  event.category === 'Sports' ? 'bg-emerald-100 text-emerald-600' :
                                  'bg-purple-100 text-purple-600'
                                }`}>
                                  {event.category === 'Holiday' ? t.dashboard.holiday :
                                   event.category === 'Academic' ? t.dashboard.exam :
                                   t.dashboard.schoolEvent}
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingEvent(event);
                                      setNewEventForm({ ...event });
                                      setIsManagingCalendar(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteEvent(event.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <h4 className="font-bold text-slate-900 mb-1">{event.title}</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <CalendarIcon className="w-3 h-3" />
                                  <span>{event.date}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  <span>{event.time}</span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2 mt-2">{event.description}</p>
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                                    <Users className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                      {getRegistrationCount(event.id)} {t.eventModal.registeredStudents}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}

                      {dashboardTab === 'Messages' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'System Messages' : 'የስርዓት መልዕክቶች'}</h3>
                              <p className="text-sm text-slate-500">{lang === 'en' ? 'Messages from students and guardians' : 'ከተማሪዎችና ከወላጆች የተላኩ መልዕክቶች'}</p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                              <MessageSquare className="w-6 h-6" />
                            </div>
                          </div>
                          <div className="space-y-4">
                            {directorMessages.length > 0 ? (
                              directorMessages.map((msg: any, i) => (
                                <div key={i} className="p-6 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {msg.from?.charAt(0) || msg.name?.charAt(0)}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-800">{msg.from || msg.name}</h4>
                                        <p className="text-xs text-slate-500">{msg.date || msg.timestamp}</p>
                                      </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      msg.subject?.includes('Urgent') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                      {msg.subject || 'General'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-600 leading-relaxed">{msg.content || msg.message}</p>
                                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end gap-2">
                                    <button className="text-xs font-bold text-blue-600 hover:underline">{lang === 'en' ? 'Reply' : 'መልስ ስጥ'}</button>
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(lang === 'en' ? 'Delete this message?' : 'ይህን መልዕክት ልሰርዘው?')) {
                                          try {
                                            await deleteDoc(doc(db, 'messages', msg.id));
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.DELETE, `messages/${msg.id}`);
                                          }
                                        }
                                      }}
                                      className="text-xs font-bold text-red-600 hover:underline"
                                    >
                                      {lang === 'en' ? 'Delete' : 'ሰርዝ'}
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-12 text-center">
                                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500">{lang === 'en' ? 'No messages yet' : 'እስካሁን ምንም መልዕክት የለም'}</p>
                              </div>
                            )}
                          </div>

                          <div className="mt-12">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Teacher Messages' : 'የመምህራን መልዕክቶች'}</h3>
                                <p className="text-sm text-slate-500">{lang === 'en' ? 'Direct communication from faculty members' : 'ከመምህራን የተላኩ ቀጥተኛ መልዕክቶች'}</p>
                              </div>
                              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <Users className="w-6 h-6" />
                              </div>
                            </div>
                            <div className="space-y-4">
                              {teacherMessages.length > 0 ? (
                                teacherMessages.map((msg) => (
                                  <div key={msg.id} className="p-6 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                          {msg.senderName.charAt(0)}
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-slate-800">{msg.senderName}</h4>
                                          <p className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleString()}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{msg.content}</p>
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end gap-2">
                                      <button className="text-xs font-bold text-blue-600 hover:underline">{lang === 'en' ? 'Reply' : 'መልስ ስጥ'}</button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="py-12 text-center">
                                  <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                  <p className="text-slate-500">{lang === 'en' ? 'No teacher messages yet' : 'እስካሁን ምንም የመምህራን መልዕክት የለም'}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'Gradebook' && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-8"
                        >
                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                              <div>
                                <h3 className="text-2xl font-bold text-slate-900">{t.dashboard.gradebook}</h3>
                                <p className="text-slate-500">{lang === 'en' ? 'Manage and post grades for all students' : 'ለሁሉም ተማሪዎች ውጤት ያስተዳድሩ እና ይለጥፉ'}</p>
                              </div>
                              <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input 
                                  type="text"
                                  placeholder={t.dashboard.searchPlaceholder}
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all"
                                />
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-50">
                                    <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{t.dashboard.tableStudent}</th>
                                    <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{t.dashboard.tableGrade}</th>
                                    <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Performance' : 'አፈጻጸም'}</th>
                                    <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-right">{t.dashboard.tableActions}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {students
                                    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((student) => {
                                      const grades = studentGrades[student.id] || [];
                                      const gpa = grades.length > 0 
                                        ? (grades.reduce((sum, g) => {
                                            const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                                            return sum + (points[g.grade] || 0);
                                          }, 0) / grades.length).toFixed(2)
                                        : '0.00';

                                      return (
                                        <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                                          <td className="py-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xs">
                                                {student.name.split(' ').map(n => n[0]).join('')}
                                              </div>
                                              <div>
                                                <div className="font-bold text-slate-900">{student.name}</div>
                                                <div className="text-xs text-slate-500">ID: {student.id}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-4">
                                            <span className="text-sm font-medium text-slate-600">{student.grade}</span>
                                          </td>
                                          <td className="py-4">
                                            <div className="flex flex-col">
                                              <span className="text-sm font-black text-blue-600">{gpa} GPA</span>
                                              <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">({grades.length} {lang === 'en' ? 'Subjects' : 'ትምህርቶች'})</span>
                                                <span className="text-[10px] text-slate-400">•</span>
                                                <span className="text-[10px] text-slate-400">({grades.reduce((sum, g) => sum + (g.assignmentCount || g.assignments?.length || 0), 0)} {t.dashboard.assignments})</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <button 
                                                onClick={() => setViewingGradeHistory(student)}
                                                className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all shadow-sm"
                                              >
                                                {lang === 'en' ? 'View History' : 'ታሪክ ይመልከቱ'}
                                              </button>
                                              <button 
                                                onClick={() => {
                                                  setPostingGradeStudent(student);
                                                  setIsPostingGrade(true);
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                                              >
                                                {t.dashboard.postGrade}
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {dashboardTab === 'Admissions' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Admission Applications' : 'የመግቢያ ማመልከቻዎች'}</h3>
                              <p className="text-sm text-slate-500">{lang === 'en' ? 'Review and manage new student applications' : 'አዳዲስ የተማሪ ማመልከቻዎችን ይገምግሙና ያስተዳድሩ'}</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                              <FileText className="w-6 h-6" />
                            </div>
                          </div>
                          <div className="space-y-4">
                            {admissions.length > 0 ? (
                              admissions.map((app: any) => (
                                <div key={app.id} className="p-6 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 font-bold text-lg">
                                        {app.studentName?.charAt(0)}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-800 text-lg">{app.studentName}</h4>
                                        <p className="text-sm text-slate-500">{lang === 'en' ? 'Applying for' : 'ለክፍል ማመልከቻ'}: <span className="font-bold text-purple-600">{app.grade}</span></p>
                                      </div>
                                    </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs text-slate-400 mb-1">{app.timestamp}</span>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                          app.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                          app.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                                          'bg-amber-100 text-amber-600'
                                        }`}>
                                          {app.status || (lang === 'en' ? 'Pending Review' : 'በመጠባበቅ ላይ')}
                                        </span>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-4 border-y border-slate-50">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">{lang === 'en' ? 'Guardian' : 'ወላጅ/አሳዳጊ'}</p>
                                      <p className="text-sm font-medium text-slate-700">{app.guardianName}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">{lang === 'en' ? 'Contact' : 'ስልክ'}</p>
                                      <p className="text-sm font-medium text-slate-700">{app.guardianPhone}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">{lang === 'en' ? 'Previous School' : 'የቀድሞ ትምህርት ቤት'}</p>
                                      <p className="text-sm font-medium text-slate-700">{app.previousSchool || 'N/A'}</p>
                                    </div>
                                  </div>
                                  {app.reply && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                      <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">{lang === 'en' ? 'Director Reply' : 'የዳይሬክተር ምላሽ'}</p>
                                      <p className="text-sm text-slate-700 italic">"{app.reply}"</p>
                                    </div>
                                  )}

                                  {replyingTo === app.id ? (
                                    <div className="mt-4 p-4 bg-slate-100 rounded-xl space-y-3">
                                      <textarea
                                        value={admissionReply}
                                        onChange={(e) => setAdmissionReply(e.target.value)}
                                        placeholder={lang === 'en' ? 'Type your reply here...' : 'ምላሽዎን እዚህ ይጻፉ...'}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => setReplyingTo(null)}
                                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all"
                                        >
                                          {lang === 'en' ? 'Cancel' : 'ሰርዝ'}
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if (!admissionReply.trim()) return;
                                            try {
                                              await updateDoc(doc(db, 'admissions', app.id), {
                                                reply: admissionReply
                                              });
                                              setReplyingTo(null);
                                              setAdmissionReply('');
                                            } catch (error) {
                                              handleFirestoreError(error, OperationType.UPDATE, `admissions/${app.id}`);
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                                        >
                                          {lang === 'en' ? 'Send Reply' : 'ምላሽ ላክ'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-4 flex justify-end gap-3">
                                      <button 
                                        onClick={() => {
                                          setReplyingTo(app.id);
                                          setAdmissionReply(app.reply || '');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                                      >
                                        <MessageSquare className="w-4 h-4" /> {lang === 'en' ? 'Reply' : 'ምላሽ'}
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (confirmModal.isOpen) return;
                                          setConfirmModal({
                                            isOpen: true,
                                            title: lang === 'en' ? 'Approve Application' : 'ማመልከቻውን አጽድቅ',
                                            message: lang === 'en' ? `Are you sure you want to approve ${app.studentName}'s application? This will create a student profile.` : `${app.studentName} ማመልከቻውን ለማጽደቅ እርግጠኛ ነዎት? ይህ የተማሪ ፕሮፋይል ይፈጥራል።`,
                                            type: 'warning',
                                            onConfirm: async () => {
                                              try {
                                                const studentId = generateNextStudentId();
                                                const studentEmail = `${app.studentName.toLowerCase().replace(/\s+/g, '.')}${studentId.slice(-4)}@student.ag.edu.et`;
                                                const defaultPassword = 'Password123!';
                                                
                                                const newStudentObj: Student = {
                                                  id: studentId,
                                                  name: app.studentName,
                                                  grade: app.grade,
                                                  email: studentEmail,
                                                  photo: `https://picsum.photos/seed/student${studentId}/400/400`,
                                                  enrollmentDate: new Date().toISOString().split('T')[0],
                                                  password: defaultPassword
                                                };

                                                // Create student profile
                                                await setDoc(doc(db, 'students', studentId), newStudentObj);

                                                // Update admission status
                                                await updateDoc(doc(db, 'admissions', app.id), {
                                                  status: 'Approved',
                                                  studentId: studentId
                                                });

                                                // Send welcome message with payment reminder
                                                const msgId = Date.now().toString();
                                                const welcomeMsg: StudentMessage = {
                                                  id: Number(msgId),
                                                  studentId: studentId,
                                                  from: 'Director',
                                                  content: lang === 'en' 
                                                    ? `Welcome to Abune Gorgorios School! Your Student ID is ${studentId}. Please pay this month's tuition fee of 15,000 ETB to complete your enrollment.` 
                                                    : `እንኳን ወደ አቡነ ጎርጎርዮስ ትምህርት ቤት በሰላም መጡ! የተማሪ መታወቂያዎ ${studentId} ነው። ምዝገባዎን ለማጠናቀቅ እባክዎ የዚህን ወር የትምህርት ክፍያ 15,000 ብር ይክፈሉ።`,
                                                  date: new Date().toISOString().split('T')[0],
                                                  category: 'Urgent'
                                                };
                                                await setDoc(doc(db, 'students', studentId, 'messages', msgId), welcomeMsg);

                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                alert(lang === 'en' ? `Application approved! Student ID: ${studentId}` : `ማመልከቻው ጸድቋል! የተማሪ መታወቂያ: ${studentId}`);
                                              } catch (error) {
                                                handleFirestoreError(error, OperationType.UPDATE, `admissions/${app.id}`);
                                              }
                                            }
                                          });
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                                      >
                                        <CheckCircle className="w-4 h-4" /> {lang === 'en' ? 'Approve' : 'አጽድቅ'}
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (window.confirm(lang === 'en' ? 'Reject this application?' : 'ይህን ማመልከቻ ልሰርዘው?')) {
                                            try {
                                              await updateDoc(doc(db, 'admissions', app.id), {
                                                status: 'Rejected'
                                              });
                                            } catch (error) {
                                              handleFirestoreError(error, OperationType.UPDATE, `admissions/${app.id}`);
                                            }
                                          }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                                      >
                                        <XCircle className="w-4 h-4" /> {lang === 'en' ? 'Reject' : 'ሰርዝ'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="py-20 text-center">
                                <FileText className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                <p className="text-slate-500">{lang === 'en' ? 'No new admission applications' : 'ምንም አዲስ የመግቢያ ማመልከቻ የለም'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : userRole === 'Teacher' ? (
                    <>
                      {dashboardTab === 'Overview' && (
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                              { label: lang === 'en' ? 'My Students' : 'የእኔ ተማሪዎች', value: students.filter(s => s.grade === userData.grade).length.toString(), icon: <Users className="text-blue-600" />, color: 'bg-blue-100' },
                              { label: lang === 'en' ? 'Subject' : 'ትምህርት', value: userData.subject || 'General', icon: <Award className="text-emerald-600" />, color: 'bg-emerald-100' },
                              { label: lang === 'en' ? 'New Messages' : 'አዳዲስ መልዕክቶች', value: teacherMessages.filter(m => !m.isRead && m.receiverId === userData.id).length.toString(), icon: <MessageSquare className="text-amber-600" />, color: 'bg-amber-100' }
                            ].map((stat, i) => (
                              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                                  {stat.icon}
                                </div>
                                <p className="text-slate-500 text-sm font-medium mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'MyStudents' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <h3 className="text-2xl font-bold text-slate-900 mb-6">{lang === 'en' ? 'My Students' : 'የእኔ ተማሪዎች'}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {students.filter(s => s.grade === userData.grade).length > 0 ? (
                              students.filter(s => s.grade === userData.grade).map(student => (
                                <div key={student.id} className="p-4 rounded-2xl border border-slate-50 flex items-center gap-4 hover:bg-slate-50 transition-all">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-800">{student.name}</h4>
                                    <p className="text-xs text-slate-500">ID: {student.id}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="col-span-full py-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>{lang === 'en' ? 'No students found in your grade' : 'በእርስዎ ክፍል ውስጥ ምንም ተማሪዎች አልተገኙም'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'Payments' && (
                        <div className="space-y-8">
                          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                              <div>
                                <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Student Payments' : 'የተማሪዎች ክፍያ'}</h3>
                                <p className="text-sm text-slate-500">{lang === 'en' ? 'Search for students to view payment history and issue receipts' : 'የክፍያ ታሪክን ለማየትና ደረሰኝ ለመቁረጥ ተማሪዎችን ይፈልጉ'}</p>
                              </div>
                              <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                  type="text"
                                  placeholder={lang === 'en' ? 'Search Student by ID or Name...' : 'ተማሪ በመለያ ቁጥር ወይም በስም ይፈልጉ...'}
                                  value={studentPaymentSearch}
                                  onChange={(e) => setStudentPaymentSearch(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                                />
                              </div>
                            </div>

                            {studentPaymentSearch.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {students
                                  .filter(s => s.id.toLowerCase().includes(studentPaymentSearch.toLowerCase()) || s.name.toLowerCase().includes(studentPaymentSearch.toLowerCase()))
                                  .slice(0, 6)
                                  .map((student) => (
                                    <button
                                      key={student.id}
                                      onClick={() => {
                                        setFoundStudentForPayment(student);
                                        setIsViewingPayments(true);
                                      }}
                                      className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all text-left group"
                                    >
                                      <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                      <div>
                                        <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{student.name}</h4>
                                        <p className="text-xs text-slate-500 mt-1">ID: {student.id} • {student.grade}</p>
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          {foundStudentForPayment && isViewingPayments && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                    <CreditCard className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Payment History' : 'የክፍያ ታሪክ'} - {foundStudentForPayment.name}</h3>
                                    <p className="text-sm text-slate-500">ID: {foundStudentForPayment.id}</p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <button 
                                    onClick={() => {
                                      setSelectedStudentForReceipt(foundStudentForPayment);
                                      setIsIssuingReceipt(true);
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all text-sm"
                                  >
                                    <FileText className="w-4 h-4" /> {lang === 'en' ? 'Issue Receipt' : 'ደረሰኝ ቁረጥ'}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setFoundStudentForPayment(null);
                                      setIsViewingPayments(false);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-slate-50">
                                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Date' : 'ቀን'}</th>
                                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Reference' : 'ማጣቀሻ'}</th>
                                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Amount' : 'መጠን'}</th>
                                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Status' : 'ሁኔታ'}</th>
                                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{lang === 'en' ? 'Action' : 'ድርጊት'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {studentPayments.length > 0 ? (
                                      studentPayments.map((payment) => (
                                        <tr key={payment.id} className="group hover:bg-slate-50/50 transition-colors">
                                          <td className="py-4 text-sm text-slate-600">{payment.date}</td>
                                          <td className="py-4 text-sm font-mono text-slate-500">{payment.reference || 'N/A'}</td>
                                          <td className="py-4 text-sm font-bold text-slate-900">{payment.amount} {t.payment.currency}</td>
                                          <td className="py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                              payment.status === 'Verified' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                              {payment.status || 'Pending'}
                                            </span>
                                          </td>
                                          <td className="py-4">
                                            <button 
                                              onClick={() => {
                                                // Preview receipt logic
                                              }}
                                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                                          {lang === 'en' ? 'No payment records found for this student.' : 'ለዚህ ተማሪ ምንም የክፍያ መዝገብ አልተገኘም።'}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {dashboardTab === 'Gradebook' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                              <h3 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Gradebook' : 'የውጤት መዝገብ'}</h3>
                              <p className="text-slate-500">{lang === 'en' ? 'Manage grades and attendance for your class' : 'ለክፍልዎ ውጤት እና መገኘት ያስተዳድሩ'}</p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                              {(['Students', 'Assignments', 'Attendance'] as const).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setGradebookSubTab(tab)}
                                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    gradebookSubTab === tab 
                                      ? 'bg-white text-blue-600 shadow-sm' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  {lang === 'en' ? tab : (tab === 'Students' ? 'ተማሪዎች' : tab === 'Assignments' ? 'ተግባራት' : 'መገኘት')}
                                </button>
                              ))}
                            </div>
                          </div>

                          {gradebookSubTab === 'Students' && (
                            <div className="space-y-6">
                              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input 
                                  type="text"
                                  placeholder={lang === 'en' ? 'Search students...' : 'ተማሪዎችን ይፈልጉ...'}
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="bg-transparent border-none outline-none w-full text-slate-900 placeholder:text-slate-400"
                                />
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-slate-100">
                                      <th className="pb-4 font-bold text-slate-900">{lang === 'en' ? 'Student' : 'ተማሪ'}</th>
                                      <th className="pb-4 font-bold text-slate-900">{lang === 'en' ? 'ID' : 'መለያ'}</th>
                                      <th className="pb-4 font-bold text-slate-900">{lang === 'en' ? 'Average' : 'አማካይ'}</th>
                                      <th className="pb-4 font-bold text-slate-900">{lang === 'en' ? 'Attendance' : 'መገኘት'}</th>
                                      <th className="pb-4 font-bold text-slate-900 text-right">{lang === 'en' ? 'Actions' : 'ተግባራት'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {students
                                      .filter(s => s.grade === userData.grade && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                      .map(student => {
                                        const grades = studentGrades[student.id] || [];
                                        const avgPercentage = grades.length > 0 
                                          ? grades.reduce((sum, g) => {
                                              if (g.assignments && g.assignments.length > 0) {
                                                const graded = g.assignments.filter(a => a.status === 'Graded');
                                                if (graded.length === 0) return sum + 0;
                                                return sum + (graded.reduce((s, a) => s + a.score, 0) / graded.reduce((s, a) => s + a.total, 0)) * 100;
                                              }
                                              return sum + 0;
                                            }, 0) / grades.length
                                          : 0;
                                        
                                        const attendance = grades.length > 0 
                                          ? grades[0].attendance 
                                          : '100%';

                                        return (
                                          <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all group">
                                            <td className="py-4">
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                                  <img src={student.photo} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                </div>
                                                <span className="font-bold text-slate-900">{student.name}</span>
                                              </div>
                                            </td>
                                            <td className="py-4 text-slate-500 font-mono text-sm">{student.studentId}</td>
                                            <td className="py-4">
                                              <div className="flex items-center gap-2">
                                                <span className={`font-bold ${avgPercentage >= 90 ? 'text-emerald-600' : avgPercentage >= 75 ? 'text-blue-600' : 'text-slate-600'}`}>
                                                  {avgPercentage > 0 ? `${avgPercentage.toFixed(1)}%` : 'N/A'}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 uppercase">
                                                  {calculateLetterGrade(avgPercentage)}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-4">
                                              <span className="text-sm text-slate-600 font-medium">{attendance}</span>
                                            </td>
                                            <td className="py-4">
                                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                  onClick={() => {
                                                    setViewingGradeHistory(student);
                                                    setGradeHistoryView('BySubject');
                                                  }}
                                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                  title={lang === 'en' ? 'View History' : 'ታሪክ ይመልከቱ'}
                                                >
                                                  <History className="w-4 h-4" />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    setPostingGradeStudent(student);
                                                    setIsPostingGrade(true);
                                                    setNewGradeForm({ ...newGradeForm, subject: userData.subject || '' });
                                                  }}
                                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
                                                >
                                                  {lang === 'en' ? 'Post Grade' : 'ውጤት መዝግብ'}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {gradebookSubTab === 'Assignments' && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900">{lang === 'en' ? 'Class Assignments' : 'የክፍል ተግባራት'}</h4>
                                <button 
                                  onClick={() => setIsAddingAssignment(true)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                                >
                                  <Plus className="w-4 h-4" /> {lang === 'en' ? 'Add Assignment' : 'ተግባር ጨምር'}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* List some assignments from the first student as a sample or show a message */}
                                {(() => {
                                  const firstStudent = students.find(s => s.grade === userData.grade);
                                  const subject = userData.subject;
                                  const assignments = firstStudent && subject 
                                    ? (studentGrades[firstStudent.id] || []).find(g => g.subject === subject)?.assignments || []
                                    : [];
                                  
                                  if (assignments.length === 0) {
                                    return (
                                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400">{lang === 'en' ? 'No assignments created yet' : 'እስካሁን ምንም ተግባራት አልተፈጠሩም'}</p>
                                      </div>
                                    );
                                  }

                                  return assignments.map(a => (
                                    <div key={a.id} className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                      <div className="flex items-start justify-between mb-4">
                                        <div>
                                          <h5 className="font-bold text-slate-900 mb-1">{a.title}</h5>
                                          <p className="text-xs text-slate-500">{lang === 'en' ? 'Due Date' : 'የማብቂያ ቀን'}: {a.date}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">
                                          {a.total} {lang === 'en' ? 'Points' : 'ነጥቦች'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                          {students.filter(s => s.grade === userData.grade).slice(0, 3).map(s => (
                                            <div key={s.id} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-slate-100">
                                              <img src={s.photo} alt={s.name} className="w-full h-full object-cover" />
                                            </div>
                                          ))}
                                          <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                            +{students.filter(s => s.grade === userData.grade).length - 3}
                                          </div>
                                        </div>
                                        <button className="text-xs font-bold text-blue-600 hover:underline">
                                          {lang === 'en' ? 'Edit Details' : 'ዝርዝሮችን አስተካክል'}
                                        </button>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}

                          {gradebookSubTab === 'Attendance' && (
                            <div className="space-y-6">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                  <h4 className="font-bold text-slate-900">{lang === 'en' ? 'Daily Attendance' : 'የዕለት መገኘት'}</h4>
                                  <p className="text-xs text-slate-500">{lang === 'en' ? 'Mark attendance for all students' : 'ለሁሉም ተማሪዎች መገኘት ይመዝግቡ'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="date" 
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 text-sm font-medium"
                                  />
                                  <button 
                                    onClick={handleSaveAttendance}
                                    disabled={isSavingAttendance}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                  >
                                    {isSavingAttendance ? (lang === 'en' ? 'Saving...' : 'በማስቀመጥ ላይ...') : (lang === 'en' ? 'Save All' : 'ሁሉንም አስቀምጥ')}
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-slate-100">
                                      <th className="pb-4 font-bold text-slate-900">{lang === 'en' ? 'Student' : 'ተማሪ'}</th>
                                      <th className="pb-4 font-bold text-slate-900 text-center">{lang === 'en' ? 'Status' : 'ሁኔታ'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {students.filter(s => s.grade === userData.grade).map(student => (
                                      <tr key={student.id} className="border-b border-slate-50">
                                        <td className="py-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100">
                                              <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-medium text-slate-800">{student.name}</span>
                                          </div>
                                        </td>
                                        <td className="py-4">
                                          <div className="flex items-center justify-center gap-2">
                                            {(['Present', 'Absent', 'Late'] as const).map((status) => (
                                              <button
                                                key={status}
                                                onClick={() => setDailyAttendance({ ...dailyAttendance, [student.id]: status })}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                  dailyAttendance[student.id] === status
                                                    ? (status === 'Present' ? 'bg-emerald-100 text-emerald-600' : status === 'Absent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')
                                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                                }`}
                                              >
                                                {lang === 'en' ? status : (status === 'Present' ? 'ተገኝቷል' : status === 'Absent' ? 'ቀርቷል' : 'ዘግይቷል')}
                                              </button>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {dashboardTab === 'Messages' && (
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h3 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Contact Director' : 'ዳይሬክተሩን ያነጋግሩ'}</h3>
                              <p className="text-slate-500">{lang === 'en' ? 'Send a message to the school director' : 'ለትምህርት ቤቱ ዳይሬክተር መልዕክት ይላኩ'}</p>
                            </div>
                            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                              <MessageSquare className="w-7 h-7" />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto space-y-4 no-scrollbar">
                              {teacherMessages.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                  <p>{lang === 'en' ? 'No messages yet' : 'እስካሁን ምንም መልዕክት የለም'}</p>
                                </div>
                              ) : (
                                teacherMessages.map((msg) => (
                                  <div key={msg.id} className={`flex ${msg.senderRole === 'teacher' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.senderRole === 'teacher' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                                      <p className="text-sm">{msg.content}</p>
                                      <p className={`text-[10px] mt-1 ${msg.senderRole === 'teacher' ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {new Date(msg.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <form onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const content = (form.elements.namedItem('message') as HTMLTextAreaElement).value;
                              if (!content.trim()) return;

                              try {
                                const newMessage: Omit<TeacherMessage, 'id'> = {
                                  senderId: userData.id,
                                  senderName: userData.name,
                                  senderRole: 'teacher',
                                  receiverId: 'Director',
                                  content: content.trim(),
                                  timestamp: new Date().toISOString(),
                                  isRead: false
                                };
                                await addDoc(collection(db, 'teacher_messages'), newMessage);
                                form.reset();
                              } catch (error) {
                                console.error('Error sending message:', error);
                              }
                            }} className="flex gap-2">
                              <textarea 
                                name="message"
                                placeholder={lang === 'en' ? 'Type your message here...' : 'መልዕክትዎን እዚህ ይጻፉ...'}
                                className="flex-1 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24"
                              ></textarea>
                              <button 
                                type="submit"
                                className="bg-blue-600 text-white px-6 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200"
                              >
                                <Send className="w-6 h-6" />
                              </button>
                            </form>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(() => {
                          const grades = studentGrades[userData.id] || [];
                          const gpa = grades.length > 0 ? (grades.reduce((sum, g) => {
                            const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                            return sum + (points[g.grade] || 0);
                          }, 0) / grades.length).toFixed(2) : '0.00';
                          
                          const avgAttendance = grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + parseInt(g.attendance), 0) / grades.length) + '%' : '0%';
                          
                          const pending = grades.reduce((sum, g) => {
                            const parts = g.status.split(' ');
                            if (parts.length >= 2) {
                              const [completed, total] = parts[0].split('/').map(Number);
                              return sum + (total - completed);
                            }
                            return sum;
                          }, 0);

                          return [
                            { label: t.dashboard.attendance, value: avgAttendance, icon: <User className="text-blue-600" />, color: 'bg-blue-100' },
                            { label: t.dashboard.gpa, value: gpa, icon: <BookOpen className="text-emerald-600" />, color: 'bg-emerald-100' },
                            { label: t.dashboard.assignments, value: lang === 'en' ? `${pending} Pending` : `${pending} የሚጠባበቁ`, icon: <CalendarIcon className="text-amber-600" />, color: 'bg-amber-100' }
                          ];
                        })().map((stat, i) => (
                          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
                              {stat.icon}
                            </div>
                            <p className="text-slate-500 text-sm font-medium mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                        {/* Upcoming Classes Section */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
                          <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-slate-900">{t.dashboard.upcomingClasses}</h3>
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                              <Clock className="w-6 h-6" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                              { subject: t.dashboard.math, time: '08:30 AM - 09:30 AM', room: 'Room 102', teacher: 'Mr. Samuel Bekele' },
                              { subject: t.dashboard.physics, time: '09:45 AM - 10:45 AM', room: 'Lab 2', teacher: 'Mrs. Helen Tadesse' },
                              { subject: t.dashboard.english, time: '11:00 AM - 12:00 PM', room: 'Room 204', teacher: 'Ms. Sara Yosef' }
                            ].map((cls, i) => (
                              <div key={i} className="p-5 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="font-bold text-slate-800 text-sm">{cls.subject}</h4>
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                    {cls.room}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mb-2 flex items-center gap-2">
                                  <Clock className="w-3 h-3" /> {cls.time}
                                </p>
                                <p className="text-[10px] text-slate-500 flex items-center gap-2">
                                  <User className="w-3 h-3" /> {cls.teacher}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Current Grades Section */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-slate-900">{t.dashboard.currentGrades}</h3>
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <GraduationCap className="w-6 h-6" />
                          </div>
                        </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(studentGrades[userData.id] || []).map((item, i) => (
                              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all group">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 text-sm">{item.subject}</span>
                                  <button 
                                    onClick={() => setSelectedSubject(item)}
                                    className="text-[10px] text-blue-600 font-bold hover:underline text-left"
                                  >
                                    {lang === 'en' ? 'View Details' : 'ዝርዝር ይመልከቱ'}
                                  </button>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-xs font-black ${item.color.replace('text-', 'bg-').replace('600', '50')} ${item.color}`}>
                                  {item.grade}
                                </span>
                              </div>
                            ))}
                          </div>
                      </div>

                      {/* Upcoming Assignments */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-slate-900">{t.dashboard.upcomingAssignments}</h3>
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                            <ClipboardList className="w-6 h-6" />
                          </div>
                        </div>
                          <div className="space-y-4">
                            {[
                              { title: lang === 'en' ? 'Physics Lab Report' : 'የፊዚክስ ላብራቶሪ ሪፖርት', due: lang === 'en' ? 'Tomorrow' : 'ነገ', status: lang === 'en' ? 'Pending' : 'የሚጠባበቅ', color: 'text-amber-600 bg-amber-50' },
                              { title: lang === 'en' ? 'History Essay' : 'የታሪክ ድርሰት', due: 'March 25', status: lang === 'en' ? 'Submitted' : 'የተላከ', color: 'text-emerald-600 bg-emerald-50' },
                              { title: lang === 'en' ? 'Math Quiz 4' : 'የሂሳብ ፈተና 4', due: 'March 22', status: lang === 'en' ? 'Pending' : 'የሚጠባበቅ', color: 'text-amber-600 bg-amber-50' }
                            ].map((task, i) => (
                              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{task.title}</h4>
                                  <p className="text-[10px] text-slate-500">{t.dashboard.dueDate}: {task.due}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${task.color}`}>
                                  {task.status}
                                </span>
                              </div>
                            ))}
                          </div>
                      </div>

                      {/* Gradebook Section */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 mt-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{t.dashboard.gradebook}</h3>
                              <p className="text-sm text-slate-500">{lang === 'en' ? 'Detailed academic performance overview' : 'ዝርዝር የትምህርት አፈጻጸም መግለጫ'}</p>
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.gpa}:</span>
                            <span className="text-sm font-black text-blue-600">
                              {(() => {
                                const grades = studentGrades[userData.id] || [];
                                if (grades.length === 0) return '0.00';
                                const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                                return (grades.reduce((sum, g) => sum + (points[g.grade] || 0), 0) / grades.length).toFixed(2);
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-50">
                                <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{t.dashboard.subject}</th>
                                <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-center">{t.dashboard.overallGrade}</th>
                                <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-center">{t.dashboard.assignmentStatus}</th>
                                <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-right">{t.dashboard.attendance}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {(studentGrades[userData.id] || [
                                { subject: t.dashboard.math, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' },
                                { subject: t.dashboard.physics, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' },
                                { subject: t.dashboard.history, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' },
                                { subject: t.dashboard.english, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' },
                                { subject: t.dashboard.biology, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' },
                                { subject: t.dashboard.chemistry, grade: 'N/A', status: '0/0', attendance: '0%', color: 'text-slate-400' }
                              ]).map((row, i) => (
                                <Fragment key={i}>
                                  <tr 
                                    onClick={() => setExpandedSubject(expandedSubject === row.subject ? null : row.subject)}
                                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                                  >
                                    <td className="py-4">
                                      <div className="flex items-center gap-2">
                                        {expandedSubject === row.subject ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        <span className="font-bold text-slate-700">{row.subject}</span>
                                      </div>
                                    </td>
                                    <td className="py-4 text-center">
                                      <span className={`font-black ${row.color}`}>{row.grade}</span>
                                    </td>
                                    <td className="py-4 text-center">
                                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                        {row.status}
                                      </span>
                                    </td>
                                    <td className="py-4 text-right">
                                      <span className="text-sm font-medium text-slate-600">{row.attendance}</span>
                                    </td>
                                  </tr>
                                  <AnimatePresence>
                                    {expandedSubject === row.subject && (currentStudentAssignments[row.subject] || row.assignments || []).length > 0 && (
                                      <tr>
                                        <td colSpan={4} className="p-0">
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-slate-50/50 px-8 py-4 overflow-hidden"
                                          >
                                            <div className="space-y-3">
                                              {(currentStudentAssignments[row.subject] || row.assignments || []).map((assignment) => (
                                                <div key={assignment.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                                      <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                      <div className="text-sm font-bold text-slate-700">{assignment.title}</div>
                                                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{assignment.date}</div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                      <div className="text-sm font-black text-slate-900">{assignment.score}/{assignment.total}</div>
                                                      <div className="text-[10px] text-slate-400 font-bold uppercase">{Math.round((assignment.score / assignment.total) * 100)}%</div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">
                                                      {assignment.status}
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        </td>
                                      </tr>
                                    )}
                                  </AnimatePresence>
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Student Messages Section */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-slate-900">{t.dashboard.messages}</h3>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            {studentMessages.filter(m => m.studentId === userData.id).length} {lang === 'en' ? 'Messages' : 'መልዕክቶች'}
                          </span>
                        </div>
                          <div className="space-y-4">
                            {studentMessages.filter(m => m.studentId === userData.id).length > 0 ? (
                              studentMessages
                                .filter(m => m.studentId === userData.id)
                                .sort((a, b) => b.id - a.id)
                                .map((msg) => (
                                  <div key={msg.id} className="p-5 rounded-2xl border border-slate-50 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                          msg.category === 'Urgent' ? 'bg-red-100 text-red-600' :
                                          msg.category === 'Academic' ? 'bg-blue-100 text-blue-600' :
                                          msg.category === 'Behavior' ? 'bg-amber-100 text-amber-600' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          <Mail className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-slate-800 text-sm">{t.dashboard.fromDirector}</h4>
                                          <p className="text-[10px] text-slate-500">{msg.date} • {
                                            msg.category === 'Urgent' ? t.dashboard.categoryUrgent :
                                            msg.category === 'Academic' ? t.dashboard.categoryAcademic :
                                            msg.category === 'Behavior' ? t.dashboard.categoryBehavior :
                                            t.dashboard.categoryGeneral
                                          }</p>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                                      {msg.content}
                                    </p>
                                  </div>
                                ))
                            ) : (
                              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-medium">{t.dashboard.noStudentMessages}</p>
                              </div>
                            )}
                          </div>
                      </div>

                      {/* Registered Events Section */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-slate-900">{t.dashboard.myEvents}</h3>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            {registeredEventIds.length} {lang === 'en' ? 'Events' : 'ኩነቶች'}
                          </span>
                        </div>
                          <div className="space-y-4">
                            {registeredEventIds.length > 0 ? (
                              events
                                .filter(event => registeredEventIds.includes(event.id))
                                .map((event) => (
                                  <div key={event.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        event.category === 'Academic' ? 'bg-blue-100 text-blue-600' :
                                        event.category === 'Sports' ? 'bg-emerald-100 text-emerald-600' :
                                        event.category === 'Holiday' ? 'bg-amber-100 text-amber-600' :
                                        'bg-purple-100 text-purple-600'
                                      }`}>
                                        <CalendarIcon className="w-6 h-6" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">{event.title}</h4>
                                        <p className="text-[10px] text-slate-500">
                                          {new Date(event.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', { month: 'short', day: 'numeric' })} • {event.time}
                                        </p>
                                        <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-blue-600 uppercase tracking-tighter">
                                          <Users className="w-2.5 h-2.5" />
                                          <span>{getRegistrationCount(event.id)} {t.eventModal.registeredStudents}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => handleRegisterEvent(event.id)}
                                      className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-red-600 hover:border-red-200 hover:shadow-sm transition-all"
                                      title={t.eventModal.unregister}
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                ))
                            ) : (
                              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-medium">{t.dashboard.noRegisteredEvents}</p>
                              </div>
                            )}
                          </div>
                      </div>

                      {/* Downloadable Resources */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Downloadable Resources' : 'ሊወርዱ የሚችሉ መረጃዎች'}</h3>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            4 {lang === 'en' ? 'Files' : 'ፋይሎች'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {[
                            { title: lang === 'en' ? 'Student Handbook 2024' : 'የተማሪዎች መመሪያ 2024', size: '2.4 MB', type: 'PDF' },
                            { title: lang === 'en' ? 'Final Exam Schedule' : 'የመጨረሻ ፈተና ፕሮግራም', size: '1.1 MB', type: 'PDF' },
                            { title: lang === 'en' ? 'Term 1 Grade Report' : 'የመጀመሪያው መንፈቅ ዓመት ውጤት', size: '450 KB', type: 'PDF' },
                            { title: lang === 'en' ? 'School Calendar' : 'የትምህርት ቤት ካላንደር', size: '3.2 MB', type: 'JPG' },
                            { title: lang === 'en' ? 'Course Syllabus' : 'የትምህርት ዝርዝር መግለጫ', size: '1.5 MB', type: 'PDF' },
                            { title: lang === 'en' ? 'Library Guide' : 'የቤተ-መጻሕፍት መመሪያ', size: '800 KB', type: 'PDF' }
                          ].map((file, i) => (
                            <div key={i} className="group flex flex-col p-5 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-xs group-hover:text-blue-700 transition-colors">{file.title}</h4>
                                  <p className="text-[10px] text-slate-500">{file.size} • {file.type}</p>
                                </div>
                              </div>
                              <button className="w-full py-2 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all">
                                <Download className="w-3 h-3" /> {lang === 'en' ? 'Download' : 'አውርድ'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  {/* Profile Section */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-600" />
                    <div className="relative pt-8 flex flex-col items-center text-center">
                      <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-lg mb-4 bg-slate-100">
                        <img 
                          src={userData.photo} 
                          alt={userData.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{userData.name}</h3>
                      <p className="text-blue-600 font-bold text-sm mb-4">{userRole === 'Director' ? (lang === 'en' ? 'School Director' : 'የትምህርት ቤት ዳይሬክተር') : userData.grade}</p>
                      
                      <div className="w-full space-y-3 pt-4 border-t border-slate-50">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{userRole === 'Director' ? (lang === 'en' ? 'Employee ID' : 'የሰራተኛ መታወቂያ') : (lang === 'en' ? 'Student ID' : 'የተማሪ መታወቂያ')}</span>
                          <span className="font-bold text-slate-900">{userData.id}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{lang === 'en' ? 'Email' : 'ኢሜይል'}</span>
                          <span className="font-bold text-slate-900 truncate ml-4">{userData.email.split('@')[0]}...</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{userRole === 'Director' ? (lang === 'en' ? 'Joined' : 'የተቀጠረበት') : (lang === 'en' ? 'Enrolled' : 'የተመዘገበበት')}</span>
                          <span className="font-bold text-slate-900">{userData.enrollmentDate}</span>
                        </div>
                      </div>
                      
                      <button className="w-full mt-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-bold transition-all border border-slate-100">
                        {t.dashboard.editProfile}
                      </button>
                    </div>
                  </div>

                  {userRole === 'Director' ? (
                    <>
                      {/* Director Messages Section */}
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'System Messages' : 'የስርዓት መልእክቶች'}</h3>
                          <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">
                            {directorMessages.length} {lang === 'en' ? 'New' : 'አዲስ'}
                          </span>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {directorMessages.length > 0 ? (
                            directorMessages.map((msg) => (
                              <div key={msg.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{lang === 'en' ? 'From' : 'ከ'}: {msg.from}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-medium">{msg.date}</span>
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm(lang === 'en' ? 'Delete this message?' : 'ይህን መልእክት ሰርዝ?')) {
                                          try {
                                            await deleteDoc(doc(db, 'messages', msg.id.toString()));
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.DELETE, `messages/${msg.id}`);
                                          }
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                              <p className="text-slate-400 text-sm">{lang === 'en' ? 'No new messages' : 'አዲስ መልእክት የለም'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#0f172a] text-white p-8 rounded-3xl shadow-xl">
                        <h3 className="text-xl font-bold mb-6">{lang === 'en' ? 'Quick Resources' : 'ፈጣን መረጃዎች'}</h3>
                        <div className="space-y-4">
                          {[
                            { name: lang === 'en' ? 'Digital Library' : 'ዲጂታል ቤተ-መጻሕፍት', icon: <BookOpen className="w-4 h-4" /> },
                            { name: lang === 'en' ? 'Student Handbook' : 'የተማሪዎች መመሪያ', icon: <FileText className="w-4 h-4" /> },
                            { name: lang === 'en' ? 'Online Payment' : 'የመስመር ላይ ክፍያ', icon: <CreditCard className="w-4 h-4 text-emerald-400" />, action: () => setIsPaymentModalOpen(true) },
                            { name: lang === 'en' ? 'Exam Schedule' : 'የፈተና ፕሮግራም', icon: <CalendarIcon className="w-4 h-4" /> },
                            { name: lang === 'en' ? 'Grade Portal' : 'የውጤት ፖርታል', icon: <GraduationCap className="w-4 h-4" /> }
                          ].map((res, i) => (
                            <button 
                              key={i} 
                              onClick={res.action}
                              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-left group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-white/40 group-hover:text-white transition-colors">
                                  {res.icon}
                                </div>
                                <span className="font-medium">{res.name}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-blue-400" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-900 mb-6">{lang === 'en' ? 'Upcoming Classes' : 'የሚቀጥሉ ክፍለ-ጊዜያት'}</h3>
                        <div className="space-y-6">
                          {[
                            { time: '08:30 AM', subject: lang === 'en' ? 'Advanced Mathematics' : 'ከፍተኛ ሂሳብ', room: lang === 'en' ? 'Room 204' : 'ክፍል 204' },
                            { time: '10:15 AM', subject: lang === 'en' ? 'World History' : 'የዓለም ታሪክ', room: lang === 'en' ? 'Room 105' : 'ክፍል 105' },
                            { time: '01:00 PM', subject: lang === 'en' ? 'Physics Laboratory' : 'የፊዚክስ ላብራቶሪ', room: lang === 'en' ? 'Lab 2' : 'ላብራቶሪ 2' }
                          ].map((cls, i) => (
                            <div key={i} className="flex gap-4">
                              <div className="text-blue-600 font-bold text-sm shrink-0 w-16">{cls.time}</div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{cls.subject}</h4>
                                <p className="text-xs text-slate-500">{cls.room}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
              {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
                  >
                    <button 
                      onClick={() => setIsPaymentModalOpen(false)}
                      className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="mb-8">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                        <CreditCard className="w-8 h-8" />
                      </div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{t.payment.title}</h2>
                      <p className="text-slate-500">{t.payment.subtitle}</p>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t.payment.accountInfo}</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-bold text-slate-700">{t.payment.bankName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                              <Hash className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-bold text-slate-700">1000123456789</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-bold text-slate-700">Abune Gorgorios School</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-700 text-sm">{t.payment.tuitionFee}</span>
                          </div>
                          <span className="font-black text-slate-900">15,000 {t.payment.currency}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                              <UserPlus className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-700 text-sm">{t.payment.registrationFee}</span>
                          </div>
                          <span className="font-black text-slate-900">1,500 {t.payment.currency}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 leading-relaxed">
                          {t.payment.paymentInstructions}
                        </p>
                      </div>

                      <button 
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                      >
                        {t.common.close}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Post Creation Modal */}
            <AnimatePresence>
              {isPosting && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsPosting(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10 max-h-[90vh] overflow-y-auto"
                  >
                    <button 
                      onClick={() => setIsPosting(false)}
                      className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? `Create New ${postType}` : `አዲስ ${postType === 'Blog' ? 'ብሎግ' : postType === 'News' ? 'ዜና' : 'ኩነት'} ይፍጠሩ`}</h2>
                    <p className="text-slate-500 mb-8">{lang === 'en' ? 'Share updates with the school community.' : 'ለትምህርት ቤቱ ማህበረሰብ መረጃዎችን ያጋሩ።'}</p>

                    <div className="flex gap-4 mb-8">
                      {(['Blog', 'News', 'Event'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setPostType(type)}
                          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                            postType === type 
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {lang === 'en' ? type : (type === 'Blog' ? 'ብሎግ' : type === 'News' ? 'ዜና' : 'ኩነት')}
                        </button>
                      ))}
                    </div>

                    <form className="space-y-6" onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const date = new Date().toISOString().split('T')[0];
                        const id = Date.now().toString();
                        if (postType === 'Blog') {
                          const blogData = { id, title: newPost.title, content: newPost.content, date, author: 'Director', image: newPost.image };
                          await setDoc(doc(db, 'blog', id), blogData);
                        } else if (postType === 'News') {
                          const newsData = { id, title: newPost.title, content: newPost.content, date, image: newPost.image };
                          await setDoc(doc(db, 'news', id), newsData);
                        } else {
                          const eventData = { id: Number(id), title: newPost.title, description: newPost.content, date: newPost.date, time: newPost.time, location: newPost.location, category: newPost.category, image: newPost.image };
                          await setDoc(doc(db, 'events', id), eventData);
                        }
                        setIsPosting(false);
                        setNewPost({ title: '', content: '', date: '', time: '', location: '', category: 'Academic', image: '' });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.WRITE, postType.toLowerCase());
                      }
                    }}>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Title' : 'ርዕስ'}</label>
                        <input 
                          type="text" 
                          value={newPost.title}
                          onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                          placeholder={lang === 'en' ? "Enter title..." : "ርዕስ ያስገቡ..."}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Photo' : 'ፎቶ'}</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setNewPost({ ...newPost, image: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                              id="post-image-upload"
                            />
                            <label 
                              htmlFor="post-image-upload"
                              className="flex items-center justify-center gap-2 w-full bg-slate-50 border border-slate-200 border-dashed rounded-xl px-4 py-4 text-sm text-slate-500 cursor-pointer hover:bg-slate-100 hover:border-blue-300 transition-all"
                            >
                              <Camera className="w-5 h-5" />
                              {newPost.image ? (lang === 'en' ? 'Change Photo' : 'ፎቶ ቀይር') : (lang === 'en' ? 'Upload Photo' : 'ፎቶ ስቀል')}
                            </label>
                          </div>
                          {newPost.image && (
                            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                              <img src={newPost.image} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>

                      {postType === 'Event' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Date' : 'ቀን'}</label>
                            <input 
                              type="date" 
                              value={newPost.date}
                              onChange={(e) => setNewPost({ ...newPost, date: e.target.value })}
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Time' : 'ሰዓት'}</label>
                            <input 
                              type="text" 
                              value={newPost.time}
                              onChange={(e) => setNewPost({ ...newPost, time: e.target.value })}
                              placeholder={lang === 'en' ? "e.g. 09:00 AM" : "ለምሳሌ 03:00 ሰዓት"}
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Content / Description' : 'ይዘት / መግለጫ'}</label>
                        <textarea 
                          value={newPost.content}
                          onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                          placeholder={lang === 'en' ? "Write something..." : "አንድ ነገር ይጻፉ..."}
                          required
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                        />
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button 
                          type="button"
                          onClick={() => setIsPosting(false)}
                          className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                          {lang === 'en' ? 'Cancel' : 'ሰርዝ'}
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                        >
                          {lang === 'en' ? 'Publish Post' : 'አውጣ'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </section>
        );
      default:
        return (
          <section className="py-32 bg-white min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-5xl font-bold text-[#0f172a] mb-8">{activePage}</h1>
            <p className="text-xl text-slate-600">Content for {activePage} is coming soon.</p>
          </section>
        );
    }
  };

  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchQuery, studentIdSearchQuery, studentGradeFilter, studentSortOrder]);

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearchQuery.toLowerCase());
    
    const matchesId = student.id.toLowerCase().includes(studentIdSearchQuery.toLowerCase());
    
    const matchesGrade = studentGradeFilter === 'All' || student.grade === studentGradeFilter;
    
    return matchesSearch && matchesId && matchesGrade;
  }).sort((a, b) => {
    const getGradeValue = (grade: string) => {
      const match = grade.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };

    if (studentSortOrder === 'Asc') {
      return a.id.localeCompare(b.id);
    } else if (studentSortOrder === 'Desc') {
      return b.id.localeCompare(a.id);
    } else if (studentSortOrder === 'GradeAsc') {
      return getGradeValue(a.grade) - getGradeValue(b.grade);
    } else {
      return getGradeValue(b.grade) - getGradeValue(a.grade);
    }
  });

  const totalStudentPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const currentStudents = filteredStudents.slice(
    (studentPage - 1) * studentsPerPage,
    studentPage * studentsPerPage
  );

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setIsResettingPassword(false);
    setLoginError('');
    setResetSuccess(false);
    setResetEmail('');
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
      {connectionError && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium z-[100]">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{connectionError}</span>
          </div>
        </div>
      )}
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => setActivePage('Home')}>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            <img 
              src="https://storage.googleapis.com/static.antigravity.dev/gemini-3-flash-preview/2026-03-20/abebeeyob64@gmail.com/1742461437146.png" 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-base md:text-lg text-[#1e293b] whitespace-nowrap">Abune Gorgorios</span>
            <span className="font-bold text-sm md:text-lg text-[#2563eb]">School</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-6">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <motion.div 
              initial={false}
              animate={{ width: isSearchOpen ? 240 : 40 }}
              className={`flex items-center bg-slate-50 border border-slate-200 rounded-full overflow-hidden transition-all ${isSearchOpen ? 'ring-2 ring-blue-100 border-blue-300' : ''}`}
            >
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 text-slate-500 hover:text-blue-600 transition-colors shrink-0"
              >
                <Search className="w-5 h-5" />
              </button>
              <input 
                type="text"
                placeholder="Search school website..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-transparent border-none outline-none text-sm w-full pr-4 transition-opacity ${isSearchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              />
            </motion.div>
          </div>

          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${lang === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('am')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${lang === 'am' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              አማ
            </button>
          </div>

          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <button 
                key={link.name} 
                onClick={() => setActivePage(link.name)}
                className={`text-sm font-medium transition-colors relative py-1 ${
                  activePage === link.name 
                    ? 'text-blue-600 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600' 
                    : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                {link.label}
              </button>
            ))}
            {isLoggedIn && (
              <button 
                onClick={() => setActivePage('Dashboard')}
                className={`text-sm font-medium transition-colors relative py-1 ${
                  activePage === 'Dashboard' 
                    ? 'text-blue-600 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600' 
                    : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                Dashboard
              </button>
            )}
          </div>

          {isLoggedIn ? (
            <button 
              onClick={() => setActivePage('Dashboard')}
              className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-100 transition-all"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                {userData.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-bold text-slate-700">My Portal</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-[#2563eb] text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-1 lg:hidden">
          <button 
            className="p-2 text-slate-600"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="w-6 h-6" />
          </button>
          <button 
            className="p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden absolute top-[65px] left-0 w-full bg-white border-b border-slate-100 p-4 z-40 shadow-lg"
          >
            <div className="relative flex items-center bg-slate-100 rounded-xl px-4 py-2">
              <Search className="w-5 h-5 text-slate-400 mr-3" />
              <input 
                type="text"
                placeholder="Search school website..."
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-base w-full"
              />
              <button onClick={() => setIsSearchOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="lg:hidden fixed inset-0 z-[60] bg-white flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://storage.googleapis.com/static.antigravity.dev/gemini-3-flash-preview/2026-03-20/abebeeyob64@gmail.com/1742461437146.png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="font-bold text-slate-900">Abune Gorgorios</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-50 rounded-full">
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <button 
                    key={link.name} 
                    className={`text-xl font-bold text-left py-3 border-b border-slate-50 flex items-center justify-between ${activePage === link.name ? 'text-blue-600' : 'text-slate-800'}`}
                    onClick={() => {
                      setActivePage(link.name);
                      setIsMenuOpen(false);
                    }}
                  >
                    {link.label}
                    <ChevronRight className={`w-5 h-5 ${activePage === link.name ? 'text-blue-600' : 'text-slate-300'}`} />
                  </button>
                ))}
                {isLoggedIn && (
                  <button 
                    className={`text-xl font-bold text-left py-3 border-b border-slate-50 flex items-center justify-between ${activePage === 'Dashboard' ? 'text-blue-600' : 'text-slate-800'}`}
                    onClick={() => {
                      setActivePage('Dashboard');
                      setIsMenuOpen(false);
                    }}
                  >
                    Dashboard
                    <ChevronRight className={`w-5 h-5 ${activePage === 'Dashboard' ? 'text-blue-600' : 'text-slate-300'}`} />
                  </button>
                )}
              </div>

              <div className="mt-12">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{lang === 'en' ? 'Select Language' : 'ቋንቋ ይምረጡ'}</p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setLang('en')}
                    className={`py-3 rounded-xl font-bold border transition-all ${lang === 'en' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setLang('am')}
                    className={`py-3 rounded-xl font-bold border transition-all ${lang === 'am' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    አማርኛ
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              {isLoggedIn ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {userData.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{userData.name}</p>
                      <p className="text-xs text-slate-500">{userData.grade || 'Director'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setIsLoggedIn(false);
                      setIsMenuOpen(false);
                      setActivePage('Home');
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200"
                  onClick={() => {
                    setIsLoginModalOpen(true);
                    setIsMenuOpen(false);
                  }}
                >
                  Login to Portal
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isAddingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingStudent(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => setIsAddingStudent(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Add New Student' : 'አዲስ ተማሪ ይጨምሩ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Create a new student profile for the school.' : 'ለትምህርት ቤቱ አዲስ የተማሪ ፕሮፋይል ይፍጠሩ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={handleAddStudent}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.studentId}</label>
                    <input 
                      type="text"
                      readOnly
                      value={newStudent.id}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Password' : 'የይለፍ ቃል'}</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      required
                      value={newStudent.password}
                      onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    placeholder={lang === 'en' ? "Enter student's full name" : "የተማሪውን ሙሉ ስም ያስገቡ"}
                    required
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Grade' : 'ክፍል'}</label>
                  <select 
                    required
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  >
                    <option value="">{lang === 'en' ? 'Select Grade' : 'ክፍል ይምረጡ'}</option>
                    <option value="9th Grade">{lang === 'en' ? '9th Grade' : '9ኛ ክፍል'}</option>
                    <option value="10th Grade">{lang === 'en' ? '10th Grade' : '10ኛ ክፍል'}</option>
                    <option value="11th Grade">{lang === 'en' ? '11th Grade' : '11ኛ ክፍል'}</option>
                    <option value="12th Grade">{lang === 'en' ? '12th Grade' : '12ኛ ክፍል'}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Email Address' : 'የኢሜል አድራሻ'}</label>
                  <input 
                    type="email" 
                    placeholder="student.name@student.ag.edu.et"
                    required
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.photoUrl}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (url) => setNewStudent({ ...newStudent, photo: url }))}
                        className="hidden"
                        id="student-photo-upload"
                      />
                      <label 
                        htmlFor="student-photo-upload"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-100"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 truncate">
                          {newStudent.photo ? (lang === 'en' ? 'Image Selected' : 'ምስል ተመርጧል') : (lang === 'en' ? 'Upload Photo' : 'ፎቶ ይስቀሉ')}
                        </span>
                      </label>
                    </div>
                    {newStudent.photo && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                        <img src={newStudent.photo} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {isUploading && <p className="text-xs text-blue-600 animate-pulse">{lang === 'en' ? 'Uploading...' : 'በመጫን ላይ...'}</p>}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200"
                >
                  {lang === 'en' ? 'Create Profile' : 'ፕሮፋይል ይፍጠሩ'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Faculty Modal */}
      <AnimatePresence>
        {isAddingFaculty && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingFaculty(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => setIsAddingFaculty(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Add New Faculty' : 'አዲስ መምህር ይጨምሩ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Create a new faculty profile for the school.' : 'ለትምህርት ቤቱ አዲስ የመምህር ፕሮፋይል ይፍጠሩ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={handleAddFaculty}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Teacher ID' : 'የመምህር መታወቂያ'}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. T-001"
                    required
                    value={newFaculty.teacherId}
                    onChange={(e) => setNewFaculty({ ...newFaculty, teacherId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    placeholder={lang === 'en' ? "Enter teacher's full name" : "የመምህሩን ሙሉ ስም ያስገቡ"}
                    required
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Title / Subject' : 'የስራ መደብ / ትምህርት'}</label>
                  <input 
                    type="text" 
                    placeholder={lang === 'en' ? "e.g. Senior Math Teacher" : "ለምሳሌ ከፍተኛ የሂሳብ መምህር"}
                    required
                    value={newFaculty.title}
                    onChange={(e) => setNewFaculty({ ...newFaculty, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Biography' : 'ግለ-ታሪክ'}</label>
                  <textarea 
                    placeholder={lang === 'en' ? "Enter teacher's biography" : "የመምህሩን ግለ-ታሪክ ያስገቡ"}
                    required
                    rows={4}
                    value={newFaculty.bio}
                    onChange={(e) => setNewFaculty({ ...newFaculty, bio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.photoUrl}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (url) => setNewFaculty({ ...newFaculty, photo: url }))}
                        className="hidden"
                        id="faculty-photo-upload"
                      />
                      <label 
                        htmlFor="faculty-photo-upload"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-100"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 truncate">
                          {newFaculty.photo ? (lang === 'en' ? 'Image Selected' : 'ምስል ተመርጧል') : (lang === 'en' ? 'Upload Photo' : 'ፎቶ ይስቀሉ')}
                        </span>
                      </label>
                    </div>
                    {newFaculty.photo && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                        <img src={newFaculty.photo} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {isUploading && <p className="text-xs text-blue-600 animate-pulse">{lang === 'en' ? 'Uploading...' : 'በመጫን ላይ...'}</p>}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200"
                >
                  {lang === 'en' ? 'Add Teacher' : 'መምህር ጨምር'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {isMessagingStudent && messagingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMessagingStudent(false);
                setMessagingStudent(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => {
                  setIsMessagingStudent(false);
                  setMessagingStudent(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{t.dashboard.sendMessage}</h2>
                <p className="text-slate-500">{lang === 'en' ? `To: ${messagingStudent.name}` : `ለ፡ ${messagingStudent.name}`}</p>
              </div>

              <form className="space-y-6" onSubmit={handleSendMessage}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Category' : 'ምድብ'}</label>
                  <select 
                    required
                    value={newMessageCategory}
                    onChange={(e) => setNewMessageCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all"
                  >
                    <option value="General">{t.dashboard.categoryGeneral}</option>
                    <option value="Academic">{t.dashboard.categoryAcademic}</option>
                    <option value="Behavior">{t.dashboard.categoryBehavior}</option>
                    <option value="Urgent">{t.dashboard.categoryUrgent}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Message' : 'መልዕክት'}</label>
                  <textarea 
                    placeholder={t.dashboard.messagePlaceholder}
                    required
                    rows={5}
                    value={newMessageContent}
                    onChange={(e) => setNewMessageContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" /> {t.dashboard.sendMessage}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingStudent && editingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditingStudent(false);
                setEditingStudent(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => {
                  setIsEditingStudent(false);
                  setEditingStudent(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Edit3 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Edit Student Profile' : 'የተማሪ ፕሮፋይል ያርሙ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Update the student\'s information below.' : 'የተማሪውን መረጃ ከታች ያዘምኑ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={handleEditStudent}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.studentId}</label>
                    <input 
                      type="text" 
                      required
                      disabled
                      value={editingStudent.id}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none cursor-not-allowed opacity-70"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Password' : 'የይለፍ ቃል'}</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      required
                      value={editingStudent.password || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    placeholder={lang === 'en' ? "Enter student's full name" : "የተማሪውን ሙሉ ስም ያስገቡ"}
                    required
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Grade' : 'ክፍል'}</label>
                  <select 
                    required
                    value={editingStudent.grade}
                    onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  >
                    <option value="">{lang === 'en' ? 'Select Grade' : 'ክፍል ይምረጡ'}</option>
                    <option value="9th Grade">{lang === 'en' ? '9th Grade' : '9ኛ ክፍል'}</option>
                    <option value="10th Grade">{lang === 'en' ? '10th Grade' : '10ኛ ክፍል'}</option>
                    <option value="11th Grade">{lang === 'en' ? '11th Grade' : '11ኛ ክፍል'}</option>
                    <option value="12th Grade">{lang === 'en' ? '12th Grade' : '12ኛ ክፍል'}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Email Address' : 'የኢሜል አድራሻ'}</label>
                  <input 
                    type="email" 
                    placeholder="student.name@student.ag.edu.et"
                    required
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.photoUrl}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (url) => setEditingStudent({ ...editingStudent, photo: url }))}
                        className="hidden"
                        id="edit-student-photo-upload"
                      />
                      <label 
                        htmlFor="edit-student-photo-upload"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-100"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 truncate">
                          {editingStudent.photo ? (lang === 'en' ? 'Image Selected' : 'ምስል ተመርጧል') : (lang === 'en' ? 'Upload Photo' : 'ፎቶ ይስቀሉ')}
                        </span>
                      </label>
                    </div>
                    {editingStudent.photo && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                        <img src={editingStudent.photo} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {isUploading && <p className="text-xs text-blue-600 animate-pulse">{lang === 'en' ? 'Uploading...' : 'በመጫን ላይ...'}</p>}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200"
                >
                  {lang === 'en' ? 'Update Profile' : 'ፕሮፋይል ያዘምኑ'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Faculty Modal */}
      <AnimatePresence>
        {isEditingFaculty && editingFaculty && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditingFaculty(false);
                setEditingFaculty(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => {
                  setIsEditingFaculty(false);
                  setEditingFaculty(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Edit3 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Edit Faculty Profile' : 'የመምህር ፕሮፋይል ያርሙ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Update the faculty member\'s information below.' : 'የመምህሩን መረጃ ከታች ያዘምኑ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={handleEditFaculty}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Teacher ID' : 'የመምህር መታወቂያ'}</label>
                  <input 
                    type="text" 
                    required
                    disabled
                    value={editingFaculty.teacherId}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none cursor-not-allowed opacity-70"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    required
                    value={editingFaculty.name}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Title / Subject' : 'የስራ መደብ / ትምህርት'}</label>
                  <input 
                    type="text" 
                    required
                    value={editingFaculty.title}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Biography' : 'ግለ-ታሪክ'}</label>
                  <textarea 
                    required
                    rows={4}
                    value={editingFaculty.bio}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, bio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.photoUrl}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (url) => setEditingFaculty({ ...editingFaculty, photo: url }))}
                        className="hidden"
                        id="edit-faculty-photo-upload"
                      />
                      <label 
                        htmlFor="edit-faculty-photo-upload"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-100"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 truncate">
                          {editingFaculty.photo ? (lang === 'en' ? 'Image Selected' : 'ምስል ተመርጧል') : (lang === 'en' ? 'Upload Photo' : 'ፎቶ ይስቀሉ')}
                        </span>
                      </label>
                    </div>
                    {editingFaculty.photo && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                        <img src={editingFaculty.photo} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {isUploading && <p className="text-xs text-blue-600 animate-pulse">{lang === 'en' ? 'Uploading...' : 'በመጫን ላይ...'}</p>}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200"
                >
                  {lang === 'en' ? 'Update Profile' : 'ፕሮፋይል ያዘምኑ'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Message Faculty Modal */}
      <AnimatePresence>
        {isMessagingFaculty && messagingFaculty && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMessagingFaculty(false);
                setMessagingFaculty(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => {
                  setIsMessagingFaculty(false);
                  setMessagingFaculty(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Message Faculty' : 'ለመምህር መልዕክት ላክ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? `To: ${messagingFaculty.name}` : `ለ፡ ${messagingFaculty.name}`}</p>
              </div>

              <form className="space-y-6" onSubmit={handleSendMessageToFaculty}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Category' : 'ምድብ'}</label>
                  <select 
                    required
                    value={newMessageCategory}
                    onChange={(e) => setNewMessageCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all"
                  >
                    <option value="General">{t.dashboard.categoryGeneral}</option>
                    <option value="Academic">{t.dashboard.categoryAcademic}</option>
                    <option value="Behavior">{t.dashboard.categoryBehavior}</option>
                    <option value="Urgent">{t.dashboard.categoryUrgent}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Message' : 'መልዕክት'}</label>
                  <textarea 
                    placeholder={t.dashboard.messagePlaceholder}
                    required
                    rows={5}
                    value={newMessageContent}
                    onChange={(e) => setNewMessageContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" /> {t.dashboard.sendMessage}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Issue Receipt Modal */}
            <AnimatePresence>
              {isIssuingReceipt && selectedStudentForReceipt && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsIssuingReceipt(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Issue Payment Receipt' : 'የክፍያ ደረሰኝ ቁረጥ'}</h3>
                      <button onClick={() => setIsIssuingReceipt(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Student' : 'ተማሪ'}</label>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-bold text-slate-700">
                          {selectedStudentForReceipt.name} ({selectedStudentForReceipt.id})
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Amount (ETB)' : 'መጠን (ብር)'}</label>
                        <input 
                          type="number"
                          value={newReceipt.amount}
                          onChange={(e) => setNewReceipt(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                          placeholder="e.g. 15000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Description' : 'መግለጫ'}</label>
                        <input 
                          type="text"
                          value={newReceipt.description}
                          onChange={(e) => setNewReceipt(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Date' : 'ቀን'}</label>
                        <input 
                          type="date"
                          value={newReceipt.date}
                          onChange={(e) => setNewReceipt(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button 
                        onClick={() => setIsIssuingReceipt(false)}
                        className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                      >
                        {lang === 'en' ? 'Cancel' : 'ሰርዝ'}
                      </button>
                      <button 
                        onClick={async () => {
                          if (!newReceipt.amount) return;
                          try {
                            const receiptId = `REC-${Date.now()}`;
                            await setDoc(doc(db, 'students', selectedStudentForReceipt.id, 'receipts', receiptId), {
                              ...newReceipt,
                              id: receiptId,
                              issuedBy: 'Director',
                              timestamp: new Date().toISOString()
                            });
                            
                            // Also send a message to the student
                            const msgId = Date.now().toString();
                            await setDoc(doc(db, 'students', selectedStudentForReceipt.id, 'messages', msgId), {
                              id: Number(msgId),
                              studentId: selectedStudentForReceipt.id,
                              from: 'Director',
                              content: lang === 'en' 
                                ? `Your payment of ${newReceipt.amount} ETB for ${newReceipt.description} has been confirmed. Receipt ID: ${receiptId}` 
                                : `የ${newReceipt.amount} ብር ክፍያዎ ለ${newReceipt.description} ተረጋግጧል። የደረሰኝ መለያ: ${receiptId}`,
                              date: new Date().toISOString().split('T')[0],
                              category: 'General'
                            });

                            setIsIssuingReceipt(false);
                            setNewReceipt({ amount: '', date: new Date().toISOString().split('T')[0], description: 'Tuition Fee' });
                            alert(lang === 'en' ? 'Receipt issued successfully!' : 'ደረሰኝ በተሳካ ሁኔታ ተቆርጧል!');
                          } catch (error) {
                            handleFirestoreError(error, OperationType.WRITE, `students/${selectedStudentForReceipt.id}/receipts`);
                          }
                        }}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                      >
                        {lang === 'en' ? 'Issue Receipt' : 'ደረሰኝ ቁረጥ'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Add Teacher Account Modal */}
            <AnimatePresence>
              {isAddingTeacherAccount && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAddingTeacherAccount(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-900">{lang === 'en' ? 'Add Teacher Login Account' : 'የመምህር መግቢያ አካውንት ጨምር'}</h3>
                      <button onClick={() => setIsAddingTeacherAccount(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Teacher ID' : 'የመምህር መለያ'}</label>
                        <input 
                          type="text"
                          value={newTeacherAccount.teacherId}
                          onChange={(e) => setNewTeacherAccount(prev => ({ ...prev, teacherId: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                          placeholder="e.g. T001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                        <input 
                          type="text"
                          value={newTeacherAccount.name}
                          onChange={(e) => setNewTeacherAccount(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Email' : 'ኢሜይል'}</label>
                        <input 
                          type="email"
                          value={newTeacherAccount.email}
                          onChange={(e) => setNewTeacherAccount(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Password' : 'የይለፍ ቃል'}</label>
                        <input 
                          type="password"
                          value={newTeacherAccount.password}
                          onChange={(e) => setNewTeacherAccount(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Subject' : 'ትምህርት'}</label>
                        <input 
                          type="text"
                          value={newTeacherAccount.subject}
                          onChange={(e) => setNewTeacherAccount(prev => ({ ...prev, subject: e.target.value }))}
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button 
                        onClick={() => setIsAddingTeacherAccount(false)}
                        className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                      >
                        {lang === 'en' ? 'Cancel' : 'ሰርዝ'}
                      </button>
                      <button 
                        onClick={async () => {
                          if (!newTeacherAccount.teacherId || !newTeacherAccount.email || !newTeacherAccount.password) return;
                          try {
                            await setDoc(doc(db, 'teachers', newTeacherAccount.teacherId), {
                              ...newTeacherAccount,
                              id: newTeacherAccount.teacherId,
                              photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newTeacherAccount.name}`
                            });
                            setIsAddingTeacherAccount(false);
                            setNewTeacherAccount({ name: '', teacherId: '', email: '', password: '', subject: '' });
                            alert(lang === 'en' ? 'Teacher account created successfully!' : 'የመምህር አካውንት በተሳካ ሁኔታ ተፈጥሯል!');
                          } catch (error) {
                            handleFirestoreError(error, OperationType.WRITE, `teachers/${newTeacherAccount.teacherId}`);
                          }
                        }}
                        className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                      >
                        {lang === 'en' ? 'Create Account' : 'አካውንት ፍጠር'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-8"
            >
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                  confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' :
                  confirmModal.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{confirmModal.title}</h2>
                <p className="text-slate-500">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  {confirmModal.cancelText || (lang === 'en' ? 'Cancel' : 'ሰርዝ')}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg ${
                    confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
                    confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' :
                    'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                  }`}
                >
                  {confirmModal.confirmText || (lang === 'en' ? 'Confirm' : 'አረጋግጥ')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Student Onboarding Modal */}
      <AnimatePresence>
        {isNewStudentOnboarding && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-white shadow-md">
                  {userData.photo ? (
                    <img src={userData.photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Welcome!' : 'እንኳን ደህና መጡ!'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Please complete your profile to continue.' : 'እባክዎ ለመቀጠል ፕሮፋይልዎን ያጠናቅቁ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                const photo = formData.get('photo') as string;

                setUserData({ ...userData, name, photo });
                setIsNewStudentOnboarding(false);

                // Send message to Director
                const msgId = Date.now().toString();
                const msg = { 
                  id: Number(msgId), 
                  from: name, 
                  content: lang === 'en' ? `A new student, ${name}, has just logged into the system.` : `አዲስ ተማሪ ${name} አሁን ወደ ሲስተሙ ገብቷል።`, 
                  date: new Date().toISOString().split('T')[0] 
                };
                setDoc(doc(db, 'messages', msgId), msg).catch(error => handleFirestoreError(error, OperationType.WRITE, 'messages'));
              }}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    name="name"
                    placeholder={lang === 'en' ? "Enter your full name" : "ሙሉ ስምዎን ያስገቡ"}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Profile Photo URL' : 'የፕሮፋይል ፎቶ URL'}</label>
                  <input 
                    type="url" 
                    name="photo"
                    placeholder="https://example.com/photo.jpg"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  {lang === 'en' ? 'Complete Profile' : 'ፕሮፋይል አጠናቅቅ'} <ChevronRight className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingProfile(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => setIsEditingProfile(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-white shadow-md">
                  <img src={editProfileData.photo} alt="Profile Preview" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Edit Profile' : 'ፕሮፋይል ያርሙ'}</h2>
                <p className="text-slate-500">{lang === 'en' ? 'Update your personal information.' : 'የግል መረጃዎን ያዘምኑ።'}</p>
              </div>

              <form className="space-y-6" onSubmit={handleSaveProfile}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Full Name' : 'ሙሉ ስም'}</label>
                  <input 
                    type="text" 
                    placeholder={lang === 'en' ? "Enter your full name" : "ሙሉ ስምዎን ያስገቡ"}
                    required
                    value={editProfileData.name}
                    onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Grade' : 'ክፍል'}</label>
                  <select 
                    required
                    value={editProfileData.grade}
                    onChange={(e) => setEditProfileData({ ...editProfileData, grade: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  >
                    <option value="9th Grade">{lang === 'en' ? '9th Grade' : '9ኛ ክፍል'}</option>
                    <option value="10th Grade">{lang === 'en' ? '10th Grade' : '10ኛ ክፍል'}</option>
                    <option value="11th Grade">{lang === 'en' ? '11th Grade' : '11ኛ ክፍል'}</option>
                    <option value="12th Grade">{lang === 'en' ? '12th Grade' : '12ኛ ክፍል'}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">{lang === 'en' ? 'Profile Photo URL' : 'የፕሮፋይል ፎቶ URL'}</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com/photo.jpg"
                    required
                    value={editProfileData.photo}
                    onChange={(e) => setEditProfileData({ ...editProfileData, photo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200"
                >
                  {lang === 'en' ? 'Save Changes' : 'ለውጦችን አስቀምጥ'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Detail Modal (Read More) */}
      <AnimatePresence>
        {selectedContent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedContent(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[3rem] overflow-hidden shadow-2xl z-10"
            >
              {selectedContent.image && (
                <div className="h-64 md:h-80 w-full relative">
                  <img 
                    src={selectedContent.image} 
                    alt={selectedContent.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>
              )}
              <div className="p-8 md:p-12">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1 pr-8">
                    {selectedContent.date && (
                      <div className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-2">
                        {new Date(selectedContent.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                      {selectedContent.title}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setSelectedContent(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <div className="prose prose-slate max-w-none max-h-[40vh] overflow-y-auto pr-4">
                  <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap">
                    {selectedContent.content}
                  </p>
                </div>
                <div className="mt-12 flex justify-end">
                  <button 
                    onClick={() => setSelectedContent(null)}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    {t.common.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Director Viewing Student Grades Modal */}
      <AnimatePresence>
        {viewingStudentGrades && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setViewingStudentGrades(null);
                setSelectedPerformanceSubject(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => {
                  setViewingStudentGrades(null);
                  setSelectedPerformanceSubject(null);
                }}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8 flex items-center gap-6">
                <img 
                  src={students.find(s => s.id === viewingStudentGrades)?.photo} 
                  alt="Student" 
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-50 shadow-sm"
                />
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {students.find(s => s.id === viewingStudentGrades)?.name}
                  </h2>
                  <p className="text-slate-500 font-medium">
                    {students.find(s => s.id === viewingStudentGrades)?.grade} • {t.dashboard.studentId}: {viewingStudentGrades}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-600" /> {lang === 'en' ? 'Performance Summary' : 'የአፈጻጸም ማጠቃለያ'}
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{t.dashboard.gpa}</span>
                        <span className="font-black text-blue-600">
                          {(() => {
                            const grades = studentGrades[viewingStudentGrades] || [];
                            if (grades.length === 0) return '0.00';
                            const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                            return (grades.reduce((sum, g) => sum + (points[g.grade] || 0), 0) / grades.length).toFixed(2);
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{t.dashboard.attendance}</span>
                        <span className="font-black text-slate-900">
                          {(() => {
                            const grades = studentGrades[viewingStudentGrades] || [];
                            if (grades.length === 0) return '0%';
                            return Math.round(grades.reduce((sum, g) => sum + parseInt(g.attendance), 0) / grades.length) + '%';
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{lang === 'en' ? 'Rank' : 'ደረጃ'}</span>
                        <span className="font-black text-amber-600">
                          {(() => {
                            const grades = studentGrades[viewingStudentGrades] || [];
                            if (grades.length === 0) return 'N/A';
                            const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                            const gpa = grades.reduce((sum, g) => sum + (points[g.grade] || 0), 0) / grades.length;
                            if (gpa >= 3.8) return 'Top 5%';
                            if (gpa >= 3.5) return 'Top 15%';
                            if (gpa >= 3.0) return 'Top 30%';
                            return 'Standard';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="max-h-[50vh] overflow-y-auto">
                      {!selectedPerformanceSubject ? (
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-6 py-4 font-bold text-slate-900 text-xs uppercase tracking-wider">{t.dashboard.subject}</th>
                              <th className="px-6 py-4 font-bold text-slate-900 text-xs uppercase tracking-wider text-center">{t.dashboard.overallGrade}</th>
                              <th className="px-6 py-4 font-bold text-slate-900 text-xs uppercase tracking-wider text-right">{t.dashboard.attendance}</th>
                              <th className="px-6 py-4 font-bold text-slate-900 text-xs uppercase tracking-wider text-right">{t.dashboard.assignments}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(studentGrades[viewingStudentGrades] || []).map((grade, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">{grade.subject}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`font-black ${grade.color}`}>{grade.grade}</span>
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-medium text-slate-600">{grade.attendance}</td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => setSelectedPerformanceSubject(grade.subject)}
                                    className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 justify-end ml-auto"
                                  >
                                    {t.dashboard.viewAssignments} <ChevronRight className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-6">
                            <button 
                              onClick={() => setSelectedPerformanceSubject(null)}
                              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" /> {lang === 'en' ? 'Back to Subjects' : 'ወደ ትምህርቶች ይመለሱ'}
                            </button>
                            <h4 className="font-black text-slate-900">{selectedPerformanceSubject} {t.dashboard.assignments}</h4>
                          </div>
                          
                          <div className="space-y-4">
                            {(currentStudentAssignments[selectedPerformanceSubject] || (studentGrades[viewingStudentGrades] || []).find(g => g.subject === selectedPerformanceSubject)?.assignments || [])
                              .map((assignment) => (
                                <div key={assignment.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                  <div>
                                    <h5 className="font-bold text-slate-900 text-sm mb-1">{assignment.title}</h5>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                      <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {assignment.date}</span>
                                      <span className={`flex items-center gap-1 ${
                                        assignment.status === 'Graded' ? 'text-emerald-600' : 
                                        assignment.status === 'Pending' ? 'text-amber-600' : 'text-blue-600'
                                      }`}>
                                        <CheckCircle className="w-3 h-3" /> {assignment.status}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-black text-slate-900">
                                      {assignment.score}<span className="text-slate-400 text-xs font-medium ml-1">/ {assignment.total}</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                      {Math.round((assignment.score / assignment.total) * 100)}%
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <button 
                  onClick={() => {
                    setMessagingStudent(students.find(s => s.id === viewingStudentGrades) || null);
                    setViewingStudentGrades(null);
                    setIsMessagingStudent(true);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" /> {t.dashboard.sendMessage}
                </button>
                <button 
                  onClick={() => {
                    setViewingStudentGrades(null);
                    setSelectedPerformanceSubject(null);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  {t.common.close}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Assignment Modal */}
      <AnimatePresence>
        {isAddingAssignment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingAssignment(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8"
            >
              <button 
                onClick={() => setIsAddingAssignment(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'Add New Assignment' : 'አዲስ ተግባር ጨምር'}</h2>
                <p className="text-slate-500 text-sm">
                  {lang === 'en' ? 'Create an assignment for all students in' : 'ለሁሉም ተማሪዎች ተግባር ይፍጠሩ በ'} <span className="font-bold text-slate-900">{userData.grade}</span>
                </p>
              </div>

              <form onSubmit={handleAddAssignmentForClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.assignmentTitle}</label>
                  <input 
                    type="text"
                    required
                    value={newAssignmentForm.title}
                    onChange={(e) => setNewAssignmentForm({ ...newAssignmentForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                    placeholder={lang === 'en' ? 'e.g. Chapter 1 Quiz' : 'ለምሳሌ፡ ምዕራፍ 1 ፈተና'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{lang === 'en' ? 'Total Points' : 'ጠቅላላ ነጥብ'}</label>
                    <input 
                      type="number"
                      required
                      value={newAssignmentForm.total}
                      onChange={(e) => setNewAssignmentForm({ ...newAssignmentForm, total: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{lang === 'en' ? 'Due Date' : 'የማብቂያ ቀን'}</label>
                    <input 
                      type="date"
                      required
                      value={newAssignmentForm.date}
                      onChange={(e) => setNewAssignmentForm({ ...newAssignmentForm, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.selectSubject}</label>
                  <select 
                    required
                    value={newAssignmentForm.subject || userData.subject}
                    onChange={(e) => setNewAssignmentForm({ ...newAssignmentForm, subject: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                  >
                    <option value={userData.subject}>{userData.subject}</option>
                    <option value={t.dashboard.math}>{t.dashboard.math}</option>
                    <option value={t.dashboard.physics}>{t.dashboard.physics}</option>
                    <option value={t.dashboard.history}>{t.dashboard.history}</option>
                    <option value={t.dashboard.english}>{t.dashboard.english}</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 mt-4"
                >
                  {lang === 'en' ? 'Create Assignment' : 'ተግባር ፍጠር'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post Grade Modal */}
      <AnimatePresence>
        {isPostingGrade && postingGradeStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPostingGrade(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8"
            >
              <button 
                onClick={() => setIsPostingGrade(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.dashboard.postGrade}</h2>
                <p className="text-slate-500 text-sm">
                  {lang === 'en' ? 'Posting grade for' : 'ውጤት እየተመዘገበለት ያለ ተማሪ'} <span className="font-bold text-slate-900">{postingGradeStudent.name}</span>
                </p>
              </div>

              {gradePostSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-emerald-900">{t.dashboard.gradePosted}</p>
                </motion.div>
              ) : (
                <form onSubmit={handlePostGrade} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.selectSubject}</label>
                    <select 
                      required
                      value={newGradeForm.subject}
                      onChange={(e) => setNewGradeForm({ ...newGradeForm, subject: e.target.value, assignmentId: '' })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">{t.dashboard.selectSubject}</option>
                      <option value={t.dashboard.math}>{t.dashboard.math}</option>
                      <option value={t.dashboard.physics}>{t.dashboard.physics}</option>
                      <option value={t.dashboard.history}>{t.dashboard.history}</option>
                      <option value={t.dashboard.english}>{t.dashboard.english}</option>
                      <option value={t.dashboard.biology}>{t.dashboard.biology}</option>
                      <option value={t.dashboard.chemistry}>{t.dashboard.chemistry}</option>
                    </select>
                  </div>

                  {newGradeForm.subject && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.selectAssignment}</label>
                      <select 
                        required
                        value={newGradeForm.assignmentId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'overall' || val === 'new') {
                            setNewGradeForm({ ...newGradeForm, assignmentId: val, assignmentTitle: '', score: '', total: '' });
                          } else {
                            const assignments = currentStudentAssignments[newGradeForm.subject] || (studentGrades[postingGradeStudent.id] || []).find(g => g.subject === newGradeForm.subject)?.assignments || [];
                            const assignment = assignments.find(a => a.id.toString() === val);
                            setNewGradeForm({ 
                              ...newGradeForm, 
                              assignmentId: val,
                              assignmentTitle: assignment ? assignment.title : '',
                              score: assignment ? assignment.score.toString() : '',
                              total: assignment ? assignment.total.toString() : ''
                            });
                          }
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="">{t.dashboard.selectAssignment}</option>
                        <option value="overall">{t.dashboard.overallGrade}</option>
                        <option value="new" className="font-bold text-blue-600">{t.dashboard.addNewAssignment}</option>
                        {(currentStudentAssignments[newGradeForm.subject] || (studentGrades[postingGradeStudent.id] || []).find(g => g.subject === newGradeForm.subject)?.assignments || []).map(a => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {newGradeForm.assignmentId === 'new' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.assignmentTitle}</label>
                      <input 
                        type="text"
                        required
                        value={newGradeForm.assignmentTitle}
                        onChange={(e) => setNewGradeForm({ ...newGradeForm, assignmentTitle: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                        placeholder={lang === 'en' ? 'e.g. Midterm Exam' : 'ለምሳሌ፡ አጋማሽ ፈተና'}
                      />
                    </motion.div>
                  )}

                  {newGradeForm.assignmentId && newGradeForm.assignmentId !== 'overall' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{lang === 'en' ? 'Score' : 'ውጤት'}</label>
                        <input 
                          type="number"
                          required
                          value={newGradeForm.score}
                          onChange={(e) => setNewGradeForm({ ...newGradeForm, score: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{lang === 'en' ? 'Total' : 'ጠቅላላ'}</label>
                        <input 
                          type="number"
                          required
                          value={newGradeForm.total}
                          onChange={(e) => setNewGradeForm({ ...newGradeForm, total: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  ) : newGradeForm.assignmentId === 'overall' ? (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.enterGrade}</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. A, B+"
                          value={newGradeForm.grade}
                          onChange={(e) => setNewGradeForm({ ...newGradeForm, grade: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.enterAttendance}</label>
                          <input 
                            type="text"
                            placeholder="95%"
                            value={newGradeForm.attendance}
                            onChange={(e) => setNewGradeForm({ ...newGradeForm, attendance: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">{t.dashboard.enterStatus}</label>
                          <input 
                            type="text"
                            placeholder="On Track"
                            value={newGradeForm.status}
                            onChange={(e) => setNewGradeForm({ ...newGradeForm, status: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  ) : null}

                  <button 
                    type="submit"
                    disabled={!newGradeForm.assignmentId}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.dashboard.postGrade}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grade History Modal */}
      <AnimatePresence>
        {viewingGradeHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingGradeHistory(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => setViewingGradeHistory(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl">
                    {viewingGradeHistory.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900">{viewingGradeHistory.name}</h2>
                    <p className="text-slate-500 font-medium">
                      {lang === 'en' ? 'Grade History & Academic Performance' : 'የውጤት ታሪክ እና የትምህርት አፈጻጸም'} • ID: {viewingGradeHistory.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: lang === 'en' ? 'Current Grade' : 'የአሁኑ ክፍል', value: viewingGradeHistory.grade, color: 'blue' },
                    { 
                      label: lang === 'en' ? 'Overall GPA' : 'ጠቅላላ GPA', 
                      value: (studentGrades[viewingGradeHistory.id] || []).length > 0 
                        ? ((studentGrades[viewingGradeHistory.id] || []).reduce((sum, g) => {
                            const points: Record<string, number> = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'N/A': 0.0 };
                            return sum + (points[g.grade] || 0);
                          }, 0) / (studentGrades[viewingGradeHistory.id] || []).length).toFixed(2)
                        : '0.00',
                      color: 'emerald' 
                    },
                    { label: lang === 'en' ? 'Subjects' : 'ትምህርቶች', value: (studentGrades[viewingGradeHistory.id] || []).length, color: 'purple' },
                    { 
                      label: lang === 'en' ? 'Total Assignments' : 'ጠቅላላ ተግባራት', 
                      value: (Object.values(currentStudentAssignments) as Assignment[][]).reduce((sum, list) => sum + list.length, 0) || (studentGrades[viewingGradeHistory.id] || []).reduce((sum, g) => sum + (g.assignmentCount || g.assignments?.length || 0), 0), 
                      color: 'amber' 
                    }
                  ].map((stat, i) => (
                    <div key={i} className={`bg-${stat.color}-50/50 border border-${stat.color}-100 p-4 rounded-2xl`}>
                      <p className={`text-[10px] font-bold text-${stat.color}-600 uppercase tracking-wider mb-1`}>{stat.label}</p>
                      <p className="text-xl font-black text-slate-800">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setGradeHistoryView('BySubject')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${gradeHistoryView === 'BySubject' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {lang === 'en' ? 'By Subject' : 'በትምህርት ዓይነት'}
                </button>
                <button 
                  onClick={() => setGradeHistoryView('AllAssignments')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${gradeHistoryView === 'AllAssignments' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {lang === 'en' ? 'All Assignments' : 'ሁሉም ተግባራት'}
                </button>
              </div>

              <div className="space-y-8 max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                {gradeHistoryView === 'BySubject' ? (
                  (studentGrades[viewingGradeHistory.id] || []).map((subjectGrade, idx) => (
                    <div key={idx} className="bg-slate-50/50 rounded-3xl border border-slate-100 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${subjectGrade.color.replace('text-', 'bg-').replace('600', '100')} rounded-xl flex items-center justify-center ${subjectGrade.color}`}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{subjectGrade.subject}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{lang === 'en' ? 'Attendance' : 'መገኘት'}: {subjectGrade.attendance}</span>
                              <span>•</span>
                              <span>{subjectGrade.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.dashboard.overallGrade}</p>
                          <p className={`text-2xl font-black ${subjectGrade.color}`}>{subjectGrade.grade}</p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Assignment' : 'ተግባር'}</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Date' : 'ቀን'}</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Score' : 'ውጤት'}</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Percentage' : 'በመቶኛ'}</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{lang === 'en' ? 'Status' : 'ሁኔታ'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(currentStudentAssignments[subjectGrade.subject] || subjectGrade.assignments || []).length > 0 ? (
                              (currentStudentAssignments[subjectGrade.subject] || subjectGrade.assignments || []).map((assignment) => (
                                <tr key={assignment.id} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-bold text-slate-800">{assignment.title}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs text-slate-500">{assignment.date}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-bold text-slate-700">{assignment.score} / {assignment.total}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                        <div 
                                          className={`h-full rounded-full ${
                                            (assignment.score / assignment.total) >= 0.9 ? 'bg-emerald-500' :
                                            (assignment.score / assignment.total) >= 0.8 ? 'bg-blue-500' :
                                            (assignment.score / assignment.total) >= 0.7 ? 'bg-amber-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${(assignment.score / assignment.total) * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-slate-600">{Math.round((assignment.score / assignment.total) * 100)}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                      assignment.status === 'Graded' ? 'bg-emerald-50 text-emerald-600' :
                                      assignment.status === 'Completed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {assignment.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                                  {lang === 'en' ? 'No assignments recorded for this subject' : 'ለዚህ ትምህርት ምንም ተግባራት አልተመዘገቡም'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Subject' : 'ትምህርት'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Assignment' : 'ተግባር'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Date' : 'ቀን'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Score' : 'ውጤት'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">{lang === 'en' ? 'Status' : 'ሁኔታ'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {Object.entries(currentStudentAssignments).length > 0 ? (
                          (Object.entries(currentStudentAssignments) as [string, Assignment[]][]).flatMap(([subject, assignments]) => 
                            assignments.map(a => ({ ...a, subject }))
                          )
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((assignment, i) => (
                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{assignment.subject}</span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-800">{assignment.title}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs text-slate-500">{assignment.date}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-700">{assignment.score} / {assignment.total} ({Math.round((assignment.score / assignment.total) * 100)}%)</p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                  assignment.status === 'Graded' ? 'bg-emerald-50 text-emerald-600' :
                                  assignment.status === 'Completed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {assignment.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                              {lang === 'en' ? 'No assignments found' : 'ምንም ተግባራት አልተገኙም'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {(!studentGrades[viewingGradeHistory.id] || studentGrades[viewingGradeHistory.id].length === 0) && (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <BookOpen className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{lang === 'en' ? 'No Academic History' : 'ምንም የትምህርት ታሪክ የለም'}</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">
                      {lang === 'en' ? 'This student does not have any grades or assignments recorded yet.' : 'ይህ ተማሪ እስካሁን ምንም ውጤት ወይም ተግባራት አልተመዘገቡለትም።'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subject Detail Modal */}
      <AnimatePresence>
        {selectedSubject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubject(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={() => setSelectedSubject(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 ${selectedSubject.color.replace('text-', 'bg-').replace('600', '100')} rounded-2xl flex items-center justify-center ${selectedSubject.color}`}>
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedSubject.subject}</h2>
                    <p className="text-slate-500 text-sm">{lang === 'en' ? 'Detailed Assignment Breakdown' : 'ዝርዝር የተግባራት መግለጫ'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.dashboard.overallGrade}</p>
                    <p className={`text-xl font-black ${selectedSubject.color}`}>{selectedSubject.grade}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.dashboard.attendance}</p>
                    <p className="text-xl font-black text-slate-700">{selectedSubject.attendance}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lang === 'en' ? 'Progress' : 'ሂደት'}</p>
                    <p className="text-xl font-black text-blue-600">{selectedSubject.status.split(' ')[0]}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                <h3 className="font-bold text-slate-900 text-lg mb-4">{lang === 'en' ? 'Assignments & Quizzes' : 'ተግባራት እና ፈተናዎች'}</h3>
                {(currentStudentAssignments[selectedSubject.subject] || selectedSubject.assignments || []).length > 0 ? (
                  (currentStudentAssignments[selectedSubject.subject] || selectedSubject.assignments || []).map((assignment) => (
                    <div key={assignment.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{assignment.title}</h4>
                        <p className="text-[10px] text-slate-500">{assignment.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">{assignment.score}/{assignment.total}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          assignment.status === 'Graded' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-slate-400 italic">{lang === 'en' ? 'No detailed assignments found' : 'ምንም ዝርዝር ተግባራት አልተገኙም'}</p>
                )}
              </div>

              <button 
                onClick={() => setSelectedSubject(null)}
                className="w-full mt-8 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg transition-all"
              >
                {t.common.close}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isManagingCalendar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingCalendar(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{editingEvent ? t.dashboard.editEvent : t.dashboard.addEvent}</h2>
                  <p className="text-sm text-slate-500">{t.dashboard.manageCalendarDesc}</p>
                </div>
                <button 
                  onClick={() => setIsManagingCalendar(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventTitle}</label>
                    <input 
                      type="text"
                      required
                      value={newEventForm.title}
                      onChange={(e) => setNewEventForm({ ...newEventForm, title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. Second Term Exams"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventType}</label>
                    <select 
                      value={newEventForm.category}
                      onChange={(e) => setNewEventForm({ ...newEventForm, category: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="Academic">{t.dashboard.exam}</option>
                      <option value="Holiday">{t.dashboard.holiday}</option>
                      <option value="Social">{t.dashboard.schoolEvent}</option>
                      <option value="Sports">{lang === 'en' ? 'Sports Event' : 'የስፖርት ኩነት'}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventDate}</label>
                    <input 
                      type="date"
                      required
                      value={newEventForm.date}
                      onChange={(e) => setNewEventForm({ ...newEventForm, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventTime}</label>
                    <input 
                      type="text"
                      required
                      value={newEventForm.time}
                      onChange={(e) => setNewEventForm({ ...newEventForm, time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. 08:30 AM"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventLocation}</label>
                    <input 
                      type="text"
                      required
                      value={newEventForm.location}
                      onChange={(e) => setNewEventForm({ ...newEventForm, location: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. School Main Hall"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">{t.dashboard.eventDescription}</label>
                    <textarea 
                      required
                      value={newEventForm.description}
                      onChange={(e) => setNewEventForm({ ...newEventForm, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all min-h-[100px]"
                      placeholder="Describe the event..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsManagingCalendar(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-all"
                  >
                    {t.common.close}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-amber-200"
                  >
                    {t.dashboard.saveEvent}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLoginModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 md:p-10"
            >
              <button 
                onClick={closeLoginModal}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  {isResettingPassword ? (lang === 'en' ? 'Reset Password' : 'የይለፍ ቃል ቀይር') : 'School Portal'}
                </h2>
                <p className="text-slate-500">
                  {isResettingPassword 
                    ? (lang === 'en' ? 'Enter your email to receive a reset link.' : 'የይለፍ ቃል መቀየሪያ ሊንክ ለማግኘት ኢሜይልዎን ያስገቡ።')
                    : 'Sign in to access your dashboard and resources.'}
                </p>
              </div>

              {!isResettingPassword ? (
                <>
                  <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                    <button 
                      onClick={() => setLoginType('student')}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                        loginType === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {lang === 'en' ? 'Student' : 'ተማሪ'}
                    </button>
                    <button 
                      onClick={() => setLoginType('teacher')}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                        loginType === 'teacher' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {lang === 'en' ? 'Teacher' : 'መምህር'}
                    </button>
                    <button 
                      onClick={() => setLoginType('director')}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                        loginType === 'director' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {lang === 'en' ? 'Director' : 'ዳይሬክተር'}
                    </button>
                  </div>

                  <div className="space-y-6">
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {loginType === 'student' ? (lang === 'en' ? 'Student ID or Email' : 'የተማሪ መታወቂያ ወይም ኢሜይል') :
                           loginType === 'teacher' ? (lang === 'en' ? 'Teacher ID or Email' : 'የመምህር መታወቂያ ወይም ኢሜይል') :
                           (lang === 'en' ? 'Director Email' : 'የዳይሬክተር ኢሜይል')}
                        </label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input 
                            type="text" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder={
                              loginType === 'student' ? (lang === 'en' ? "e.g. STU001" : "ለምሳሌ STU001") :
                              loginType === 'teacher' ? (lang === 'en' ? "e.g. TEA001" : "ለምሳሌ TEA001") :
                              "abebeeyob64@gmail.com"
                            }
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-slate-700">Password</label>
                          <button 
                            type="button"
                            onClick={() => {
                              setIsResettingPassword(true);
                              setLoginError('');
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >
                            {lang === 'en' ? 'Forgot Password?' : 'የይለፍ ቃል ረስተዋል?'}
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input 
                            type="password" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            required
                          />
                        </div>
                        {loginPassword && (
                          <div className="mt-2 space-y-1">
                            <div className="flex gap-1 h-1">
                              {[1, 2, 3, 4].map((i) => (
                                <div 
                                  key={i}
                                  className={`flex-1 rounded-full transition-all duration-500 ${
                                    i <= passwordStrength ? getStrengthColor(passwordStrength) : 'bg-slate-100'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${
                              passwordStrength <= 2 ? 'text-red-500' : passwordStrength === 3 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {getStrengthText(passwordStrength)}
                            </p>
                          </div>
                        )}
                      </div>
                      <button 
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                      </button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-slate-500">Or continue with</span>
                      </div>
                    </div>

                    <button 
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm"
                    >
                      <Chrome className="w-5 h-5 text-blue-500" />
                      {lang === 'en' ? 'Sign in with Google' : 'በGoogle ይግቡ'}
                    </button>

                    {loginError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {loginError}
                      </motion.div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {lang === 'en' ? 'Registered Email Address' : 'የተመዘገበ የኢሜይል አድራሻ'}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                          type="email" 
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === 'en' ? 'Send Reset Link' : 'ዳግም ማስጀመሪያ ሊንክ ላክ')}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsResettingPassword(false);
                        setLoginError('');
                        setResetSuccess(false);
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-all"
                    >
                      {lang === 'en' ? 'Back to Login' : 'ወደ መግቢያ ተመለስ'}
                    </button>
                  </form>

                  {resetSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {lang === 'en' ? 'Reset link sent! Please check your email.' : 'ዳግም ማስጀመሪያ ሊንክ ተልኳል! እባክዎ ኢሜይልዎን ያረጋግጡ።'}
                    </motion.div>
                  )}

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {loginError}
                    </motion.div>
                  )}
                </div>
              )}

              <p className="mt-8 text-center text-slate-500 text-sm">
                Need help? <button className="text-blue-600 font-bold hover:underline">Contact IT Support</button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-grow">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-white py-20">
        <div className="container mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Column 1: About */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://storage.googleapis.com/static.antigravity.dev/gemini-3-flash-preview/2026-03-20/abebeeyob64@gmail.com/1742461437146.png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg">Abune Gorgorios</span>
                  <span className="font-bold text-lg text-blue-400">School</span>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed text-sm">
                {lang === 'en' 
                  ? 'Committed to excellence in education, fostering a community of learners, and preparing our students for a successful future.'
                  : 'በትምህርት የላቀ ውጤት ለማምጣት፣ የተማሪዎችን ማህበረሰብ ለማፍራት እና ተማሪዎቻችንን ለተሳካ የወደፊት ህይወት ለማዘጋጀት ቁርጠኛ ነን።'}
              </p>
              <div className="flex items-center gap-4 pt-4">
                {[
                  { icon: <Facebook className="w-5 h-5" />, href: "#", label: "Facebook" },
                  { icon: <Twitter className="w-5 h-5" />, href: "#", label: "Twitter" },
                  { icon: <Instagram className="w-5 h-5" />, href: "#", label: "Instagram" },
                  { icon: <Youtube className="w-5 h-5" />, href: "#", label: "Youtube" }
                ].map((social, i) => (
                  <a 
                    key={i} 
                    href={social.href} 
                    aria-label={social.label}
                    className="w-10 h-10 bg-white/5 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-lg font-bold mb-6">{t.footer.quickLinks}</h4>
              <ul className="space-y-4">
                {['Home', 'About', 'Admissions', 'Academics', 'Faculty'].map((item) => (
                  <li key={item}>
                    <button 
                      onClick={() => setActivePage(item as Page)}
                      className="text-slate-400 hover:text-blue-400 transition-colors text-sm"
                    >
                      {t.nav[item.toLowerCase() as keyof typeof t.nav]}
                    </button>
                  </li>
                ))}
                {isLoggedIn && (
                  <li>
                    <button 
                      onClick={() => setActivePage('Dashboard')}
                      className="text-slate-400 hover:text-blue-400 transition-colors text-sm"
                    >
                      {t.nav.dashboard}
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Column 3: Contact */}
            <div>
              <h4 className="text-lg font-bold mb-6">{t.footer.contact}</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-400 text-sm">
                  <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>{lang === 'en' ? 'Addis Ababa, Ethiopia' : 'አዲስ አበባ፣ ኢትዮጵያ'}</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400 text-sm">
                  <Mail className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>info@abunegorgorios.edu</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400 text-sm">
                  <Phone className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>+251 (011) 123-4567</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Newsletter */}
            <div>
              <h4 className="text-lg font-bold mb-6">{lang === 'en' ? 'Newsletter' : 'ጋዜጣ'}</h4>
              <p className="text-slate-400 text-sm mb-6">{lang === 'en' ? 'Stay updated with school news.' : 'በትምህርት ቤቱ ዜናዎች እንደተዘመኑ ይቆዩ።'}</p>
              <div className="space-y-3">
                <input 
                  type="email" 
                  placeholder={lang === 'en' ? 'Enter your email' : 'ኢሜልዎን ያስገቡ'} 
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors"
                />
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2">
                  {t.common.send}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
            © {new Date().getFullYear()} Abune Gorgorios School. {t.footer.rights}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isViewingIdCard && viewingIdCard && (
          <StudentIDCard 
            student={viewingIdCard} 
            onClose={() => {
              setIsViewingIdCard(false);
              setViewingIdCard(null);
            }} 
            onIssue={() => handleIssueIdCard(viewingIdCard.id)}
            isDirector={userRole === 'Director'}
            lang={lang}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8">
              <WifiOff className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              {lang === 'en' ? 'No Internet Connection' : 'የኢንተርኔት ግንኙነት የለም'}
            </h1>
            <p className="text-slate-400 max-w-md text-lg">
              {lang === 'en' 
                ? 'This application requires an active internet connection to function. Please check your WiFi or mobile data and try again.' 
                : 'ይህ መተግበሪያ እንዲሰራ ንቁ የኢንተርኔት ግንኙነት ይፈልጋል። እባክዎ የእርስዎን WiFi ወይም የሞባይል ዳታ ይፈትሹ እና እንደገና ይሞክሩ።'}
            </p>
            <div className="mt-10 flex gap-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse delay-75" />
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse delay-150" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Analytics />
    </div>
  );
}
