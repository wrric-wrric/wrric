-# 📌 Profile & Entity Association – Final Instructions (Corrected)

## 1️⃣ User Profile Rules (Core Constraint)

1. Every registered user **must have a default profile**.
2. Upon user registration:

   * A **default profile is automatically created**.
   * The default profile is populated using data from the **user table**, such as:

     * full name
     * avatar / profile image
     * organization / affiliation (if available)
     * role or position (if available)
3. In addition to the default profile:

   * A user **may create at most one (1) additional profile**.
4. Therefore, a user can have:

   * **Minimum:** 1 profile (default)
   * **Maximum:** 2 profiles (default + one additional)
5. The default profile:

   * Always exists
   * Cannot be deleted
   * Acts as the fallback identity

---

## 2️⃣ Profile Fallback & Resolution Logic

6. If a user has not created an additional profile:

   * The **default profile is used everywhere**.
7. If profile fields are incomplete:

   * Missing values must be resolved from the **user table**.
8. Profile resolution priority:

   1. Explicitly selected profile (if applicable)
   2. Default profile
   3. User table data (fallback)

---

## 3️⃣ Authentication & Login Behavior

9. On successful login:

   * The API must return:

     * user information
     * all available profiles (1 or 2)
     * the default profile identifier
10. The frontend must be able to:

    * immediately determine the user’s active/default profile
    * render profile-related UI without an additional fetch

---

## 4️⃣ Profile Management Rules

11. Users may:

    * Edit the default profile
    * Create **one** additional profile
    * Edit the additional profile
12. Users may not:

    * Create more than one additional profile
    * Delete the default profile
13. If the additional profile is deleted:

    * The default profile remains unchanged and continues to be used

---

## 5️⃣ Lab / Entity Creation Flow

14. When a user creates a lab or entity:

    * The system must present the user with a **choice of their available profiles** (1 or 2).
15. The user must select **which profile** the lab/entity is associated with.
16. The selected profile becomes:

    * the public-facing identity of the lab/entity
    * the profile shown to other users when viewing the lab/entity

---

## 6️⃣ Profile Association Rules

17. Each lab/entity must be associated with **exactly one profile**.
18. A single profile may be associated with **multiple labs/entities**.
19. Profile association determines:

    * displayed name
    * avatar
    * affiliation
    * public identity

---

## 7️⃣ Public Viewing Behavior

20. When another user views a lab/entity:

    * Only the **associated profile’s information** is visible.
21. User account details:

    * must never be exposed publicly
    * are used only internally for authentication and authorization

---

## 8️⃣ Authorization & Ownership

22. Only the owner of a profile may:

    * associate that profile with a lab/entity
    * modify or delete labs/entities associated with it
23. Authorization checks must follow:

    * authenticated user → owned profiles → associated entities

---

## 9️⃣ Frontend Integration Documentation (Mandatory)

24. After implementing these features:

    * A **comprehensive frontend integration document must be created**.
25. This document must clearly describe:

    * how profile data is received at login
    * how default vs additional profiles are handled in the UI
    * how profile selection works during lab/entity creation
    * how public profile information is rendered
    * how fallback behavior works when profile data is incomplete
26. The document must serve as:

    * a reference guide for frontend developers
    * onboarding material for future contributors
    * the single source of truth for profile-related UI behavior

---

