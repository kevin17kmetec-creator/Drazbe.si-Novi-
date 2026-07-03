import { auth, db } from "./firebase";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";

class SupabaseFilterBuilder {
  constructor(public table: string, public promise: any) {}

  eq(column: string, value: any): any {
    return this;
  }
  single(): any {
    return this;
  }
  then(resolve: any, reject: any) {
    return this.promise.then(resolve, reject);
  }
}

class SupabaseQueryBuilder {
  constructor(public table: string) {}

  select(columns = "*"): any {
    const p = getDocs(collection(db, this.table)).then(snapshot => {
       return { data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), error: null };
    });
    return new SupabaseFilterBuilder(this.table, p);
  }

  upsert(data: any): any {
    const p = (async () => {
       if (data.id) {
          await setDoc(doc(db, this.table, data.id), data, { merge: true });
       } else {
          await addDoc(collection(db, this.table), data);
       }
       return { error: null };
    })();
    return new SupabaseFilterBuilder(this.table, p);
  }

  insert(data: any): any {
    const p = (async () => {
       const ref = await addDoc(collection(db, this.table), data);
       const snapshot = await getDoc(ref);
       return { data: { id: snapshot.id, ...snapshot.data() }, error: null };
    })();
    return {
      select: () => new SupabaseFilterBuilder(this.table, p),
      then: (resolve: any, reject: any) => p.then(resolve, reject)
    };
  }

  update(data: any): any {
    const p = Promise.resolve({ data: null, error: null });
    const filter = new SupabaseFilterBuilder(this.table, p);
    filter.eq = (field: string, val: string): any => {
         const updatePromise = updateDoc(doc(db, this.table, val), data).then(async () => {
             const snapshot = await getDoc(doc(db, this.table, val));
             return { data: { id: snapshot.id, ...snapshot.data() }, error: null };
         });
         return new SupabaseFilterBuilder(this.table, updatePromise);
    };
    return filter;
  }
}

export const supabase: any = {
  auth: {
    getSession: async (): Promise<any> => {
       return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
             unsubscribe();
             resolve({ data: { session: user ? { user: { id: user.uid, email: user.email }, access_token: "mock_token" } : null }, error: null });
          });
       });
    },
    getUser: async (): Promise<any> => {
       return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
             unsubscribe();
             resolve({ data: { user: user ? { id: user.uid, email: user.email } : null }, error: null });
          });
       });
    },
    onAuthStateChange: (cb: any) => {
       const unsubscribe = onAuthStateChanged(auth, (user) => {
          cb(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user: { id: user.uid, email: user.email }, access_token: "mock_token" } : null);
       });
       return { data: { subscription: { unsubscribe } } };
    },
    signInWithPassword: async ({ email, password }: any) => {
       try {
           const cred = await signInWithEmailAndPassword(auth, email, password);
           return { data: { user: { id: cred.user.uid, email: cred.user.email } }, error: null };
       } catch(error) {
           return { data: null, error };
       }
    },
    signInWithOAuth: async ({ provider }: any) => {
       return { data: null, error: new Error("Not implemented") };
    },
    signUp: async ({ email, password, options }: any) => {
       try {
           const cred = await createUserWithEmailAndPassword(auth, email, password);
           if (options?.data) {
               await setDoc(doc(db, "users", cred.user.uid), { ...options.data, email }, { merge: true });
           }
           return { data: { user: { id: cred.user.uid, email: cred.user.email } }, error: null };
       } catch(error) {
           return { data: null, error };
       }
    },
    signOut: async () => {
       await signOut(auth);
       return { error: null };
    },
    updateUser: async ({ password }: any) => {
       try {
           if (auth.currentUser && password) {
               await updatePassword(auth.currentUser, password);
           }
           return { error: null };
       } catch (error) {
           return { error };
       }
    },
    resetPasswordForEmail: async (email: string, options?: any) => {
       try {
           await sendPasswordResetEmail(auth, email);
           return { error: null };
       } catch(error) {
           return { error };
       }
    }
  },
  from: (table: string) => new SupabaseQueryBuilder(table),
  storage: {
     from: (bucket: string) => ({
         upload: async (path: string, file: any, opts: any) => {
             return { data: { path }, error: null }; // Mocked storage
         },
         getPublicUrl: (path: string) => {
             return { data: { publicUrl: `https://mock-storage.com/${bucket}/${path}` } };
         },
         createSignedUrl: async (path: string, expiry: number) => {
             return { data: { signedUrl: `https://mock-storage.com/${bucket}/${path}` }, error: null };
         },
         remove: async (paths: string[]) => {
             return { data: null, error: null };
         }
     })
  },
  channel: (name: string) => {
      const ch: any = {
         on: (event: any, filter: any, callback: any) => ch,
         subscribe: (cb: any) => {
             if (cb) cb("SUBSCRIBED");
             return ch;
         }
      };
      return ch;
  },
  removeChannel: async (ch: any) => {},
  removeAllChannels: async () => {}
};
