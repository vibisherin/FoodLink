import { createContext, useContext, useState, useEffect } from "react";


const FoodLinkContext = createContext();


const initialFoodItems = [
  { id: 1, name: "Cooked Rice", quantity: "10 kg", expiryHours: 6, status: "" },
  { id: 2, name: "Bread", quantity: "20 packs", expiryHours: 48, status: "" },
  { id: 3, name: "Vegetables", quantity: "15 kg", expiryHours: 12, status: "" },
  { id: 4, name: "Milk", quantity: "10 litres", expiryHours: 72, status: "" },
];


function calculateStatus(expiryHours) {
  if (expiryHours <= 0) return "Expired";
  if (expiryHours <= 24) return "Expiring Soon";
  return "Available";
}

export function FoodLinkProvider({ children }) {
  const [restaurantName, setRestaurantName] = useState("Green Bowl Restaurant");
  const [foodItems, setFoodItems] = useState(initialFoodItems);

 
  useEffect(() => {
    setFoodItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        status: calculateStatus(item.expiryHours),
      }))
    );
    
  }, [foodItems.length]);

  const addFood = (newFood) => {
    setFoodItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        status: calculateStatus(newFood.expiryHours),
        ...newFood,
      },
    ]);
  };

  const updateFood = (id, updates) => {
    setFoodItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              status: calculateStatus(updates.expiryHours ?? item.expiryHours),
            }
          : item
      )
    );
  };

  const deleteFood = (id) => {
    setFoodItems((prev) => prev.filter((item) => item.id !== id));
  };

  const value = {
    restaurantName,
    setRestaurantName,
    foodItems,
    addFood,
    updateFood,
    deleteFood,
  };

  return (
    <FoodLinkContext.Provider value={value}>
      {children}
    </FoodLinkContext.Provider>
  );
}


export function useFoodLink() {
  return useContext(FoodLinkContext);
}

export default FoodLinkContext;
