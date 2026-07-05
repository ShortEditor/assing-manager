// One-time admin setup script
// Run with: node scripts/create-admin.mjs

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpXoJZyrjPlK9bv1tuGsuqRiyWZDkQFbI",
  authDomain: "assing-tracker.firebaseapp.com",
  projectId: "assing-tracker",
  storageBucket: "assing-tracker.firebasestorage.app",
  messagingSenderId: "299237686854",
  appId: "1:299237686854:web:ec602c4cf6b9076b3b1447"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = 'g.nagaganesh44@gmail.com';
const PASSWORD = 'Ganesh@12';
const NAME = 'Ganesh';

async function setup() {
  console.log('🔧 Setting up admin account...\n');

  let uid;

  // Try to create user — if already exists, sign in instead
  try {
    const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
    uid = cred.user.uid;
    console.log('✅ Firebase Auth user created:', uid);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('ℹ️  User already exists in Auth — signing in to get UID...');
      const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
      uid = cred.user.uid;
      console.log('✅ Signed in, UID:', uid);
    } else {
      throw err;
    }
  }

  // Write to Firestore admins collection
  await setDoc(doc(db, 'admins', uid), {
    name: NAME,
    email: EMAIL,
    role: 'super_admin',
    createdAt: serverTimestamp(),
  });

  console.log('✅ Firestore admins document written');
  console.log('\n🎉 Admin setup complete!');
  console.log('   Email   :', EMAIL);
  console.log('   Password:', PASSWORD);
  console.log('   UID     :', uid);
  console.log('\nYou can now log in at http://localhost:3000/login → Admin tab');
  process.exit(0);
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message ?? err);
  process.exit(1);
});
