# AROHA — Adaptive Digital Twin for Personalized Learning

> An AI-powered learning ecosystem combining a **Digital Twin, parent-supervised learning, behavioral analytics, an AI study companion, and adaptive gamification**.

---

## 🌟 Overview

**AROHA** is a full-stack personalized learning platform designed to make studying more **adaptive, accountable, engaging, and personalized**.

Instead of functioning as only a study timer, AI chatbot, or content platform, AROHA brings the complete learning workflow into a single ecosystem.

The platform provides two learning experiences:

* **Self-Directed Learning** — students independently plan and manage their study sessions with AI assistance, focus tools, quizzes, notes, and gamification.
* **Parent-Supervised Learning** — parents can connect with their children, assign learning activities and materials, monitor study progress, and provide structured supervision.

At the center of the platform is a **Digital Twin** that maintains an evolving behavioral representation of the student based on study-session data.

---

# 🎯 Problem

Students often depend on multiple disconnected applications for:

* Studying and understanding concepts
* Watching learning resources
* Taking quizzes
* Making revision notes
* Tracking study time
* Getting help with doubts
* Monitoring learning progress

At the same time, parents may have limited visibility into what their children are actually studying and whether their planned learning activities are being completed consistently.

This creates a gap between **learning, supervision, AI assistance, and progress tracking**.

---

# 💡 Our Solution

AROHA combines these capabilities into a single learning ecosystem.

The system allows parents to structure and monitor a child's learning while giving the student an interactive environment containing:

**Study → Learn → Ask → Practice → Track → Revise → Improve**

The platform continuously records study behavior and uses it to update the student's Digital Twin, provide behavioral insights, and drive the companion's gamification state.

---

# 🧠 Digital Twin

The core concept of AROHA is its **student Digital Twin**.

A Digital Twin is a continuously updated digital representation of a real-world entity.

In AROHA, the entity is the **student**.

The Digital Twin maintains behavioral information based on study sessions, including:

* Focus activity
* Distractions
* Study duration
* Goals
* Goal completion
* Consistency
* Historical study patterns
* Prediction accuracy

The profile is maintained **per student and subject**, allowing the system to build a more personalized representation of the learner.

### Behavioral Loop

```text
Study Session
      ↓
Behavioral Data
      ↓
Digital Twin Update
      ↓
Historical Pattern Analysis
      ↓
Behavioral Predictions
      ↓
Personalized Insights
      ↓
Next Learning Session
```

The current behavioral prediction layer is **deterministic and interpretable**, while generative AI is handled separately through Anthropic Claude.

---

# 👨‍👩‍👧 Parent-Supervised Learning

One of AROHA's key differentiators is its **parent-supervised learning ecosystem**.

A parent and child are connected through a controlled linking and approval workflow.

### Parent → Child Workflow

```text
Parent
  ↓
Generates Invite Code
  ↓
Child Joins
  ↓
Parent Approves Relationship
  ↓
Supervised Learning Begins
```

Once linked, parents can:

* Plan learning activities
* Assign study material
* Manage assignments
* Schedule learning tasks
* Monitor study activity
* Track progress
* View learning analytics
* Observe behavioral improvement

This provides parents with greater visibility while allowing the child to continue studying within the same application.

---

# 🤖 AI Study Companion — Reo

AROHA provides an in-app AI companion called **Reo**.

Reo acts as the student's conversational study companion and can provide:

* Study guidance
* Doubt-solving assistance
* Motivational responses
* Contextual feedback
* Study-session interaction

AROHA integrates **Anthropic Claude Sonnet 4.5** to generate natural-language responses.

The architecture separates behavioral computation from language generation:

```text
Student Behavior
      ↓
AROHA Behavioral Engine
      ↓
Structured Insights
      ↓
Claude Sonnet 4.5
      ↓
Natural-Language Response
      ↓
Reo
```

This allows the application to keep behavioral metrics deterministic while using generative AI for natural interaction.

---

# 📚 Material-Grounded AI Learning

Parents can provide learning resources to the student.

These resources can include:

* PDFs
* Documents
* Text-based study material
* YouTube learning resources

Uploaded learning material can be processed and used as context for generating educational content.

### Grounded Quiz Generation

```text
Parent Assigns Material
        ↓
Material Processing
        ↓
Relevant Learning Content
        ↓
AI Generation
        ↓
Quiz / Study Prompts
```

This allows quizzes and study prompts to be based on the student's **assigned learning material**, rather than generating completely unrelated generic questions.

---

# 🎥 Integrated Learning Resources

Parents can also provide relevant **YouTube learning resources** as part of the student's study material.

This allows external learning resources to become part of the structured learning workflow instead of requiring the student to independently search for additional content.

---

# 📝 Smart Revision Notes

AROHA also supports a revision workflow directly inside the learning environment.

Students can:

1. Study their material
2. Highlight important sections
3. Collect useful highlights
4. Generate a PDF containing selected highlights
5. Save the generated revision material for future reference

```text
Study Material
      ↓
Highlight Important Content
      ↓
Selected Highlights
      ↓
Generate PDF
      ↓
Revision Reference
```

This turns reading material into reusable revision notes.

---

# ⏱️ Focus & Study Sessions

AROHA provides structured study sessions with tools for monitoring learning activity.

The system can track:

* Planned study duration
* Actual study activity
* Focus activity
* Distractions
* Breaks
* Goal completion
* Session progress

This information contributes to the student's Digital Twin and behavioral analytics.

---

# 🧩 Interactive Study Activities

AROHA includes interactive activities to keep the student engaged within the same learning environment.

### Focus Timer

Students can conduct structured focus sessions while the system records relevant behavioral events.

### Sudoku

AROHA also includes Sudoku-based interactive activities with difficulty-based gameplay.

Students can solve puzzles without leaving the learning environment, adding an interactive element alongside conventional study activities.

---

# 🎮 Behavior-Driven Gamification

AROHA connects actual study behavior with gamification through the evolving robot companion **Reo**.

Study behavior contributes to:

* XP
* Streaks
* Discipline progress
* Energy
* Evolution stage

### Evolution Flow

```text
Study Behavior
      ↓
Session Evaluation
      ↓
Discipline / XP
      ↓
Streak & Progress
      ↓
Evolution Requirements
      ↓
Reo Evolves
```

The evolution system is **rule-based**, making the relationship between study behavior and progression transparent and predictable.

---

# 📊 Behavioral Analytics

The Digital Twin maintains historical behavioral metrics such as:

* Average focus activity
* Average session duration
* Distraction behavior
* Goal completion rate
* Consistency
* Prediction accuracy
* Historical study patterns

The system can use accumulated behavior to provide personalized insights rather than treating every study session independently.

---

# 🏗️ System Architecture

```text
                         AROHA
                           │
              ┌────────────┴────────────┐
              │                         │
       React Native App            FastAPI Backend
        Expo + TypeScript             Python
              │                         │
              │                    ┌────┴─────┐
              │                    │          │
              │                MongoDB    Anthropic
              │                           Claude
              │
       Student / Parent
          / Child UI
```

### Backend Responsibilities

The FastAPI backend handles:

* Authentication
* User management
* Parent-child relationships
* Study sessions
* Digital Twin logic
* Behavioral analytics
* Predictions
* Assignments
* Learning materials
* AI orchestration
* Quiz generation
* Robot evolution
* Revision-note generation

---

# 🔄 End-to-End Learning Flow

```text
Parent / Student
       ↓
Learning Activity
       ↓
Study Session
       ↓
Focus / Distraction / Goal Tracking
       ↓
Session Summary
       ↓
Digital Twin Update
       ↓
Behavioral Analysis
       ↓
Personalized Prediction / Insight
       ↓
Claude Generates Contextual Response
       ↓
Reo Provides Guidance
       ↓
XP / Streak / Evolution Updated
       ↓
Next Learning Session
```

---

# 🛠️ Technology Stack

## Frontend

* React Native
* Expo
* TypeScript
* Expo Router

## Backend

* Python
* FastAPI
* Pydantic
* REST APIs

## Database

* MongoDB
* Motor

## AI

* Anthropic Claude Sonnet 4.5

## Authentication & Security

* JWT-based authentication infrastructure
* Password hashing
* Parent-child authorization workflows

## Development Tools

* Git
* GitHub
* VS Code

---

# 🔐 Security & Access Control

AROHA includes authentication and controlled access mechanisms for its multi-role environment.

The system distinguishes between:

* Students
* Parents
* Children

Parent-child access is established through an explicit linking and approval workflow rather than allowing arbitrary access to another user's learning information.

Sensitive configuration such as database credentials, API keys, and authentication secrets should remain in environment configuration rather than being exposed in the client application.

---

# 🧱 Project Structure

```text
AROHA/
│
├── backend/
│   ├── server.py
│   ├── API routes
│   ├── authentication
│   ├── Digital Twin logic
│   ├── AI integration
│   └── database integration
│
├── frontend/
│   ├── React Native screens
│   ├── components
│   ├── navigation
│   └── API integration
│
├── tests/
├── test_reports/
├── README.md
└── .gitignore
```

---

# ⭐ What Makes AROHA Different?

AROHA is designed as more than an AI chatbot or productivity application.

Its central idea is the combination of:

### 🧠 Digital Twin

An evolving behavioral representation of the student.

### 👨‍👩‍👧 Parent Supervision

A structured parent-child learning relationship with controlled monitoring and assignment workflows.

### 🤖 Generative AI

An in-app AI companion powered by Claude.

### 📚 Grounded Learning

AI-generated quizzes and study prompts based on assigned learning material.

### 📝 Revision Workflow

Highlight important material and convert it into reusable PDF revision notes.

### 🎮 Adaptive Gamification

Study behavior affects XP, streaks, discipline and Reo's evolution.

### 📊 Behavioral Analytics

Historical study behavior is converted into personalized insights and predictions.

Together, these create a continuous learning ecosystem:

```text
             ┌──────────────┐
             │    STUDY     │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   OBSERVE    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │ DIGITAL TWIN │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   ANALYZE    │
             └──────┬───────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   AI GUIDANCE              GAMIFICATION
        ↓                       ↓
       REO                  EVOLUTION
        └───────────┬───────────┘
                    ↓
             NEXT SESSION
```

---

# 🚀 Future Scope

Potential extensions include:

* Training dedicated ML models for behavioral prediction
* Personalized difficulty adjustment
* Knowledge-gap detection
* Learning-performance forecasting
* Intelligent study scheduling
* Recommendation systems for learning resources
* Long-term behavioral pattern analysis
* More advanced adaptive-learning strategies

---

# 📌 Project Status

**Active Development**

AROHA is being continuously enhanced with additional learning, AI, behavioral analytics, personalization, and gamification capabilities.

---

## 👩‍💻 Author

**Sharvari S**
Computer Science & Engineering
RV College of Engineering

