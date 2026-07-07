import { auth, db } from "./firebase";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";

class SupabaseFilterBuilder {
  private wheres: any[] = [];
  constructor(public table: string, public p_upsert?: any, public p_insert?: any, public is_select: boolean = false) {}
  
  eq(column: string, value: any): any {
    this.wheres.push({ column, value });
    return this;
  }
  
  async single(): Promise<any> {
    if (this.is_select) {
        let q: any = collection(db, this.table);
        for (const w of this.wheres) {
            if (w.column === 'id') {
                const snap = await getDoc(doc(db, this.table, w.value));
                return { data: snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null, error: null };
            }
            q = query(q, where(w.column, '==', w.value));
        }
        const snap = await getDocs(q);
        if (snap.empty) return { data: null, error: null };
        return { data: { id: snap.docs[0].id, ...(snap.docs[0].data() as any) }, error: null };
    }
    return { data: null, error: null };
  }
  
  then(resolve: any, reject: any) {
    if (this.is_select) {
        let q: any = collection(db, this.table);
        for (const w of this.wheres) {
            if (w.column !== 'id') {
                q = query(q, where(w.column, '==', w.value));
            }
        }
        return getDocs(q).then(snapshot => {
             const docs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
             return { data: docs, error: null };
        }).then(resolve, reject);
    }
    if (this.p_upsert) return this.p_upsert.then(resolve, reject);
    if (this.p_insert) return this.p_insert.then(resolve, reject);
    return Promise.resolve({ data: null, error: null }).then(resolve, reject);
  }
}

class SupabaseQueryBuilder {
  constructor(public table: string) {}
  select(columns = "*"): any {
    return new SupabaseFilterBuilder(this.table, null, null, true);
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
    return new SupabaseFilterBuilder(this.table, p, null, false);
  }
  insert(data: any): any {
    const p = (async () => {
       const ref = await addDoc(collection(db, this.table), data);
       const snapshot = await getDoc(ref);
       return { data: { id: snapshot.id, ...(snapshot.data() as any) }, error: null };
    })();
    return {
      select: () => new SupabaseFilterBuilder(this.table, null, p, false),
      then: (resolve: any, reject: any) => p.then(resolve, reject)
    };
  }
  update(data: any): any {
    const filter = new SupabaseFilterBuilder(this.table);
    filter.eq = (field: string, val: string): any => {
         const updatePromise = updateDoc(doc(db, this.table, val), data).then(async () => {
             const snapshot = await getDoc(doc(db, this.table, val));
             return { data: { id: snapshot.id, ...(snapshot.data() as any) }, error: null };
         });
         return new SupabaseFilterBuilder(this.table, updatePromise, null, false);
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
             return { data: { path }, error: null }; 
         },
         getPublicUrl: (path: string) => {
             return { data: { publicUrl: `https://storage.googleapis.com/${bucket}/${path}` } };
         },
         createSignedUrl: async (path: string, expiry: number) => {
             return { data: { signedUrl: `https://storage.googleapis.com/${bucket}/${path}` }, error: null };
         },
         remove: async (paths: string[]) => {
             return { data: null, error: null };
         }
     })
  },
  channel: (name: string) => {
      let unsubscribe: any = null;
      const ch: any = {
         on: (event: any, filter: any, callback: any) => {
             if (filter?.table === 'auctions') {
                 let initial = true;
                 unsubscribe = onSnapshot(collection(db, 'auctions'), () => {
                     if (initial) { initial = false; return; }
                     callback({ type: 'UPDATE' });
                 });
             }
             return ch;
         },
         subscribe: (cb: any) => {
             if (cb) cb("SUBSCRIBED");
             return ch;
         }
      };
      ch.__unsubscribe = () => { if (unsubscribe) unsubscribe(); };
      return ch;
  },
  removeChannel: async (ch: any) => {
      if (ch && ch.__unsubscribe) ch.__unsubscribe();
  },
  removeAllChannels: async () => {}
};
