import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  remove as removeData,
} from 'firebase/database';

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import {initializeApp } from 'firebase/app';

interface FirebaseConfig {
apiKey: string,
authDomain: string,
projectId: string,
storageBucket: string,
messagingSenderId: string,
appId: string,
measurementId: string
}

const config = (config: FirebaseConfig) => {
  return initializeApp(config);
};

const app = config({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',
});

const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

interface Address {
  type?:string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}
interface DeliveryAddress extends Address {
  deliveryNotes?: string;
  deliveryManId: string;
}
interface Preferences {
  language: string;
  currency: string;
}
interface Delivery {
  status: string;
  deliveryDate: string;
  deliveryAddress: DeliveryAddress;
  livelocation?:string
}
interface UserData {
  firstName: string;
  email: string;
  password: string;
  lastName?: string;
  photoURL?:string;
  gender?: string;
  birthdate?: string;
  address?: Address;
  phone: string;
  createdAt?: string;
  wishlist?: string[];
  loyaltyPoints?: number;
  preferences?: Preferences;
  delivery?: Delivery;
  [customField: string]: any;
}
interface ProductCart {
  productId: string;
  quantity: number;
  addedToCart: string;
}
interface Order {
  orderId: string;
  orderDate?: string;
  cancelDate?:string;
  confirmDate?:string;
  products: ProductCart[];
  status:string;
  payment?: {
    paymentId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    status:string;
  };
  delivery?: Delivery;
}
interface Customer {
  userId: string;
  userData: UserData;
  productCart?: ProductCart[];
  orders?: Order[];
}
interface Product {
  productId: string;
  name: string;
  category: string;
  foodtype?:string;
  brand: string;
  description: string;
  mrp: number;
  price: number;
  offers?: string;
  discount?: number;
  images?: string[]; // Array of image URLs
  video?: string; // Video URL
  quantity?: number;
  stock?: number;
  specifications?: { [key: string]: any };
  reviews?: { [key: string]: any };
  ratings?: { [key: string]: any };
  customFields?: { [key: string]: any }; // Index signature for custom fields
}

interface AdminData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
  createdAt?: string;
  lastLogin?: string;
  settings?: {
    theme: string;
    notifications: {
      email: boolean;
      sms: boolean;
    };
  };
  photoURL?: string;
  [customField: string]: any; // Index signature for custom fields
}
interface DeliveryManData extends UserData {
  availability: boolean;
  assignedOrders: string[];
  completedOrders: string[];
  deliveryHistory: {
    orderId: string;
    deliveryDate: string;
    deliveryStatus: string;
  }[];
  // Generic custom field
  [customField: string]: any;
}
interface DeliveryMan {
  userId: string;
  userType: string;
  userData: DeliveryManData;
}
const customerService = {
  registerCustomer: async (Customer: Customer, photo: File) => {
    try {
      const { email, password, photoURL } = Customer.userData;
      const { ...otherUserData } = Customer;
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
      // Get the UID of the authenticated user
      const userId = userCredential.user?.uid;
  
      // Upload photo to storage
      const photoRef = storageRef(storage, `customer_photos/${userId}`);
      await uploadBytes(photoRef, photo);
  
      // Get the photo URL
      const photoU = await getDownloadURL(photoRef);
      Customer.userData.photoURL=photoU
  
      // Save additional customer data to Realtime Database
      await set(ref(database, `users/customer/${userId}`), {
        ...otherUserData,
      });
  
      return userId;
    } catch (error) {
      console.error('Error registering customer:', error);
    }
  },

  loginCustomer: async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const userId = auth.currentUser?.uid;

      // Fetch customer data from Realtime Database
      const userDataSnapshot = await get(ref(database, `users/customer/${userId}`));
      const userData = userDataSnapshot.val();

      return { userId, userData };
    } catch (error) {
      console.error('Error logging in customer:', error);
      throw error;
    }
  },

  updateCustomer: async (userId: string, updatedUserData: Partial<UserData>) => {
    try {
      await update(ref(database, `users/customer/${userId}`), updatedUserData);
      return 'Customer updated successfully';
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  deleteCustomer: async () => {
    try {
      // Delete auth user
      await signOut(auth);

      // Delete customer data from Realtime Database
      const userId = auth.currentUser?.uid;
      await set(ref(database, `users/customer/${userId}`), null);

      return 'Customer deleted successfully';
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  addToCart: async (userId: string, productId: string, quantity: number) => {
    try {
      const userRef = ref(database, `users/customer/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      const updatedCart = [...(userData.productCart || []), { productId, quantity, addedToCart: new Date().toISOString() }];
      
      await set(userRef, { productCart: updatedCart });

      return 'Product added to the cart successfully';
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  },

  updateCart: async (userId: string, updatedCart: ProductCart[]) => {
    try {
      await update(ref(database, `users/customer/${userId}`), { productCart: updatedCart });
      return 'Cart updated successfully';
    } catch (error) {
      console.error('Error updating cart:', error);
      throw error;
    }
  },

  placeOrder: async (userId: string, orderData: Order) => {
    try {
      const userRef = ref(database, `users/customer/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      await update(userRef, {
        orders: [...(userData.orders || []), orderData],
        productCart: [], // Clear the cart after placing an order
      });

      return 'Order placed successfully';
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  },
  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user} = result;

      if (user) {
        const userId = user.uid;
        const userDataSnapshot = await get(ref(database, `users/customer/${userId}`));
        const userData = userDataSnapshot.val();

        return { userId, userData };
      }

      throw new Error('Google login failed');
    } catch (error) {
      console.error('Error logging in with Google:', error);
      throw error;
    }
  },

  loginWithFacebook: async () => {
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user} = result;

      if (user) {
        const userId = user.uid;
        const userDataSnapshot = await get(ref(database, `users/customer/${userId}`));
        const userData = userDataSnapshot.val();

        return { userId, userData};
      }

      throw new Error('Facebook login failed');
    } catch (error) {
      console.error('Error logging in with Facebook:', error);
      throw error;
    }
  }
};
const productService = {
  generateUniqueId: () => {
    const timestamp = new Date().getTime().toString(36);
    const randomString = Math.random().toString(36).substr(2, 5);
    return `${timestamp}_${randomString}`;
  },
  addProduct: async (product: Product, images: File[], video: File | null) => {
    try {
    
      const productId = productService.generateUniqueId(); // Generate a unique product ID

      // Upload images to storage
      const imageUrls: string[] = [];
      for (const image of images) {
        const imageRef = storageRef(storage, `product_images/${productId}_${image.name}`);
        await uploadBytes(imageRef, image);
        const imageUrl = await getDownloadURL(imageRef);
        imageUrls.push(imageUrl);
      }
      product.images = imageUrls;
      product.productId=productId;

      // Upload video to storage if provided
      if (video) {
        const videoRef = storageRef(storage, `product_videos/${productId}_${video.name}`);
        await uploadBytes(videoRef, video);
        product.video = await getDownloadURL(videoRef);
      }

      // Save product data to Realtime Database
      await set(ref(database, `products/${productId}`), product);

      return productId;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  },

  updateProduct: async (productId: string, updatedProductData: Partial<Product>) => {
    try {
      await update(ref(database, `products/${productId}`), updatedProductData);
      return 'Product updated successfully';
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  getProductDetails: async (productId: string) => {
    try {
      const productSnapshot = await get(ref(database, `products/${productId}`));
      return productSnapshot.val();
    } catch (error) {
      console.error('Error fetching product details:', error);
      throw error;
    }
  },

  deleteProduct: async (productId: string) => {
    try {
      // Delete product data from Realtime Database
      await removeData(ref(database, `products/${productId}`));

      // Delete product images from storage
      const imagesRef = storageRef(storage, `product_images/`);
      const imagesFiles = await listAll(imagesRef);
      imagesFiles.items.forEach(async (imageFile) => {
        if (imageFile.name.startsWith(productId)) {
          await deleteObject(imageFile);
        }
      });

      // Delete product video from storage if exists
      const videoRef = storageRef(storage, `product_videos/${productId}`);
      await deleteObject(videoRef).catch(() => {}); // Ignore if video doesn't exist

      return 'Product deleted successfully';
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },
  getAllProducts: async () => {
    try {
      const productsSnapshot = await get(ref(database, 'products'));
      const productsData = productsSnapshot.val();
      
      // Convert the object of products into an array
      const productsArray: Product[] = [];
      for (const key in productsData) {
        if (Object.prototype.hasOwnProperty.call(productsData, key)) {
          productsArray.push({ productId: key, ...productsData[key] });
        }
      }

      return productsArray;
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  },
};
const adminService = {
  registerAdmin: async (adminData: AdminData, photo: File) => {
    try {
      const { email, password, photoURL } = adminData;
      const { ...otherAdminData } = adminData;

      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
      // Get the UID of the authenticated user
      const userId = userCredential.user?.uid;
  
      // Upload photo to storage
      const photoRef = storageRef(storage, `admin_photos/${userId}`);
      await uploadBytes(photoRef, photo);
  
      // Get the photo URL
      const photoU = await getDownloadURL(photoRef);
      adminData.photoURL = photoU;
  
      // Save additional admin data to Realtime Database
      await set(ref(database, `users/admin/${userId}`), {
        ...otherAdminData,
      });
  
      return userId;
    } catch (error) {
      console.error('Error registering admin:', error);
      throw error;
    }
  },

  loginAdmin: async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const userId = auth.currentUser?.uid;

      // Fetch admin data from Realtime Database
      const adminDataSnapshot = await get(ref(database, `users/admin/${userId}`));
      const adminData = adminDataSnapshot.val();

      return { userId, adminData };
    } catch (error) {
      console.error('Error logging in admin:', error);
      throw error;
    }
  },

  updateAdmin: async (userId: string, updatedAdminData: Partial<AdminData>) => {
    try {
      await update(ref(database, `users/admin/${userId}`), updatedAdminData);
      return 'Admin updated successfully';
    } catch (error) {
      console.error('Error updating admin:', error);
      throw error;
    }
  },

  deleteAdmin: async () => {
    try {
      // Delete auth user
      await signOut(auth);

      // Delete admin data from Realtime Database
      const userId = auth.currentUser?.uid;
      await set(ref(database, `users/admin/${userId}`), null);

      return 'Admin deleted successfully';
    } catch (error) {
      console.error('Error deleting admin:', error);
      throw error;
    }
  },

  getAdminDetails: async (userId: string) => {
    try {
      const adminDataSnapshot = await get(ref(database, `users/admin/${userId}`));
      return adminDataSnapshot.val();
    } catch (error) {
      console.error('Error fetching admin details:', error);
      throw error;
    }
  },

  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user } = result;

      if (user) {
        const userId = user.uid;
        const adminDataSnapshot = await get(ref(database, `users/admin/${userId}`));
        const adminData = adminDataSnapshot.val();

        return { userId, adminData };
      }

      throw new Error('Google login failed');
    } catch (error) {
      console.error('Error logging in with Google:', error);
      throw error;
    }
  },

  loginWithFacebook: async () => {
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user } = result;

      if (user) {
        const userId = user.uid;
        const adminDataSnapshot = await get(ref(database, `users/admin/${userId}`));
        const adminData = adminDataSnapshot.val();

        return { userId, adminData };
      }

      throw new Error('Facebook login failed');
    } catch (error) {
      console.error('Error logging in with Facebook:', error);
      throw error;
    }
  },
};
const deliveryManService = {
  registerDeliveryMan: async (deliveryMan: DeliveryMan, photo: File) => {
    try {
      const { email, password, photoURL } = deliveryMan.userData;
      const { ...otherUserData } = deliveryMan;
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Get the UID of the authenticated user
      const userId = userCredential.user?.uid;

      // Upload photo to storage
      const photoRef = storageRef(storage, `deliveryman_photos/${userId}`);
      await uploadBytes(photoRef, photo);

      // Get the photo URL
      const photoU = await getDownloadURL(photoRef);
      deliveryMan.userData.photoURL = photoU;

      // Save additional delivery man data to Realtime Database
      await set(ref(database, `users/deliveryman/${userId}`), {
        ...otherUserData,
      });

      return userId;
    } catch (error) {
      console.error('Error registering delivery man:', error);
      throw error;
    }
  },

  updateDeliveryMan: async (userId: string, updatedDeliveryManData: Partial<DeliveryManData>) => {
    try {
      await update(ref(database, `users/deliveryman/${userId}`), updatedDeliveryManData);
      return 'Delivery man updated successfully';
    } catch (error) {
      console.error('Error updating delivery man:', error);
      throw error;
    }
  },

  deleteDeliveryMan: async (userId: string) => {
    try {
      // Delete auth user
      await signOut(auth);

      // Delete delivery man data from Realtime Database
      await set(ref(database, `users/deliveryman/${userId}`), null);

      return 'Delivery man deleted successfully';
    } catch (error) {
      console.error('Error deleting delivery man:', error);
      throw error;
    }
  },

  // Add/update custom fields for delivery men
  updateCustomFields: async (userId: string, customFields: Partial<DeliveryManData>) => {
    try {
      await update(ref(database, `users/deliveryman/${userId}`), customFields);
      return 'Custom fields updated successfully';
    } catch (error) {
      console.error('Error updating custom fields:', error);
      throw error;
    }
  },

  assignOrder: async (userId: string, orderId: string) => {
    try {
      const userRef = ref(database, `users/deliveryman/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      const updatedAssignedOrders = [...(userData.assignedOrders || []), orderId];
      await update(userRef, { assignedOrders: updatedAssignedOrders });

      return 'Order assigned successfully';
    } catch (error) {
      console.error('Error assigning order:', error);
      throw error;
    }
  },

  completeOrder: async (userId: string, orderId: string, deliveryStatus: string) => {
    try {
      const userRef = ref(database, `users/deliveryman/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      const updatedAssignedOrders = userData.assignedOrders?.filter((id: string) => id !== orderId) || [];
      const updatedCompletedOrders = [...(userData.completedOrders || []), orderId];
      const deliveryHistoryItem = {
        orderId,
        deliveryDate: new Date().toISOString(),
        deliveryStatus,
      };
      const updatedDeliveryHistory = [...(userData.deliveryHistory || []), deliveryHistoryItem];

      await update(userRef, {
        assignedOrders: updatedAssignedOrders,
        completedOrders: updatedCompletedOrders,
        deliveryHistory: updatedDeliveryHistory,
      });

      return 'Order completed successfully';
    } catch (error) {
      console.error('Error completing order:', error);
      throw error;
    }
  },

  getAssignedOrders: async (userId: string) => {
    try {
      const userRef = ref(database, `users/deliveryman/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      return userData.assignedOrders || [];
    } catch (error) {
      console.error('Error fetching assigned orders:', error);
      throw error;
    }
  },

  getCompletedOrders: async (userId: string) => {
    try {
      const userRef = ref(database, `users/deliveryman/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      return userData.completedOrders || [];
    } catch (error) {
      console.error('Error fetching completed orders:', error);
      throw error;
    }
  },

  getDeliveryHistory: async (userId: string) => {
    try {
      const userRef = ref(database, `users/deliveryman/${userId}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      return userData.deliveryHistory || [];
    } catch (error) {
      console.error('Error fetching delivery history:', error);
      throw error;
    }
  },
};


export { config,customerService, productService, adminService, deliveryManService,auth, database, storage };  export type {FirebaseConfig,DeliveryMan,DeliveryManData,AdminData,Product,Customer,Order,ProductCart,UserData,Delivery,Preferences,DeliveryAddress,Address};

