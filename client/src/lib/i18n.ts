import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Typically we would fetch these from a backend or load from separate JSON files,
// but for a mockup, we'll inline the translations.
const resources = {
  en: {
    translation: {
      nav: {
        home: "Home",
        services: "Services",
        about: "About Us",
        login: "Clients",
        partners: "Partners",
        admin: "Admin",
        moverLogin: "Mover Portal",
        adminLogin: "Admin Portal",
        getQuote: "Get a Quote"
      },
      common: {
        email: "Email",
        password: "Password",
        businessEmail: "Business Email",
        clickHere: "Click here",
        partnership: "In partnership with",
        forgotPassword: "Forgot your password?",
        error: "Error",
        success: "Success",
        loading: "Loading...",
        save: "Save",
        cancel: "Cancel",
        close: "Close",
        phone: "Phone",
        view: "View",
        viewAll: "View All",
        noneSelected: "None selected"
      },
      login: {
        success: "Welcome back!",
        subtitle: "Sign in to manage your moves",
        continueWith: "Continue with Social Login",
        providers: "Secure sign-in with your favorite provider",
        tabLogin: "Sign In",
        tabSignup: "Sign Up",
        welcomeBack: "Welcome Back",
        createAccount: "Create Account",
        signupSubtitle: "Start your moving journey with us",
        signupWith: "Sign up with Social Login",
        signInEmail: "Sign in with Email",
        createAccountBtn: "Create Account",
        fullName: "Full Name",
        passwordHint: "Minimum 6 characters",
        signupSuccess: "Account created successfully!",
        or: "or",
        error: {
          required: "Please enter your email and password",
          invalid: "Invalid email or password",
          allFieldsRequired: "Please fill in all fields",
          passwordLength: "Password must be at least 6 characters",
          registration: "Registration failed"
        }
      },
      hero: {
        title: "Now we don't just store your belongings. We help you move them, too",
        subtitle: "Quote a move that begins or ends at a participating U-Storage branch.",
        ctaUser: "Quote moving + storage",
        ctaMover: "I am a mover",
        ctaAdmin: "Admin Access",
        trusted: "Moving and storage, connected",
        instantQuote: "Quote your move",
        comparePrices: "Get an initial estimate in minutes",
        movesThisMonth: "Moves this month",
        rating: "Rating",
        features: {
          insured: "Protection options by service",
          verified: "Verified crews",
          rates: "Clear initial estimate"
        },
        howItWorks: {
          title: "How U-Storage Go Works",
          step1: { title: "Tell us what you need", desc: "Share what you need to move, store, and where it needs to go." },
          step2: { title: "Get your estimate", desc: "Receive a clear initial estimate based on your information." },
          step3: { title: "Coordinate both services", desc: "Confirm your move and connect it with U-Storage when you need space." }
        }
      },
      partners: {
        hero: {
          badge: "For Moving Professionals",
          title: "Grow your moving business with U-Storage Go",
          subtitle: "Work with U-Storage Go. Get high-quality moving jobs, manage your work efficiently, and get paid faster.",
          cta: "Become a Partner",
          existing: "Already a partner?"
        },
        login: {
          button: "Partner Login",
          link: "Log in here",
          welcome: "Welcome Back, Partner",
          subtitle: "Access your partner dashboard"
        },
        signup: {
          title: "Join Our Network",
          subtitle: "Start growing your moving business",
          button: "Create Partner Account"
        },
        benefits: {
          title: "Why partner with us?",
          subtitle: "We provide the tools and leads you need to succeed",
          1: {
            title: "Quality Leads",
            desc: "Stop chasing cold leads. Get verified, high-intent move requests directly to your dashboard."
          },
          2: {
            title: "Smart Management",
            desc: "Manage your fleet, schedule, and crew from one intuitive mobile-friendly platform."
          },
          3: {
            title: "Clear payment tracking",
            desc: "Review service and payment status from your partner dashboard."
          }
        },
        cta: {
          title: "Ready to scale your business?",
          subtitle: "Join the U-Storage Go partner network and receive moving opportunities that match your coverage."
        }
      },
      clients: {
        hero: {
          badge: "For Customers",
          title: "Relax, we handle your move",
          subtitle: "Track your move, manage documents, and communicate with your movers all in one place.",
          cta: "Get a Quote",
          existing: "Already have an account?"
        },
        login: {
          button: "Client Login",
          link: "Log in here"
        },
        benefits: {
          title: "Your Move, Simplified",
          subtitle: "Everything you need for a stress-free relocation",
          1: {
            title: "Professional Crews",
            desc: "Your service is assigned to a verified crew, with details available before confirmation."
          },
          2: {
            title: "Transparent Pricing",
            desc: "Get a clear initial estimate and review the final service scope before you commit."
          },
          3: {
            title: "Protection options",
            desc: "Review the protection conditions available for your service before confirming."
          }
        },
        cta: {
          title: "Ready to move or free up space?",
          subtitle: "Request an initial estimate for your move and connect it with U-Storage when you need storage."
        }
      },
      adminLanding: {
        badge: "Administration",
        title: "Platform Control Center",
        subtitle: "Secure access for U-Storage Go administrators. Manage users, partners, and platform settings.",
        features: {
          analytics: "Real-time Analytics",
          management: "Platform Management"
        },
        login: {
          title: "Admin Login",
          subtitle: "Enter your credentials to access the portal",
          email: "Email",
          password: "Password",
          button: "Access Dashboard",
          forgot: "Forgot your password?"
        },
        signup: {
          title: "Admin Registration",
          subtitle: "Create your admin account",
          button: "Create Admin Account"
        },
        error: {
          notAdmin: "This account is not authorized for admin access"
        },
        securityNote: "Admin access is restricted to authorized personnel only.",
        noAccount: "Don't have an admin account?",
        requestAccess: "Request Admin Access",
        request: {
          title: "Request Admin Access",
          description: "Submit your request to become an administrator. A super admin will review your application.",
          sentTitle: "Request Submitted",
          sentDescription: "Your request has been submitted for review.",
          namePlaceholder: "Your Full Name",
          company: "Company/Organization",
          companyPlaceholder: "Your company name",
          justification: "Why do you need admin access?",
          justificationPlaceholder: "Briefly explain your role and why you need admin access...",
          submit: "Submit Request",
          success: "Your request has been submitted successfully!",
          successMessage: "Your request has been submitted. A super admin will review it and you'll receive an email once approved.",
          error: {
            required: "Please enter your name and email"
          }
        }
      },
      forgotPassword: {
        link: "Forgot your password?",
        title: "Reset Your Password",
        sentTitle: "Check Your Email",
        description: "Enter your email address and we'll send you a link to reset your password.",
        sentDescription: "If an account with that email exists, we've sent you a password reset link.",
        emailRequired: "Please enter your email address",
        sendButton: "Send Reset Link",
        checkEmail: "Check your inbox for the password reset link. The link will expire in 1 hour.",
        backToLogin: "Back to Login",
        error: "Unable to process your request. Please try again.",
        success: "If an account with that email exists, a reset link has been sent.",
        resetTitle: "Set New Password",
        resetDescription: "Enter your new password below.",
        newPassword: "New Password",
        confirmPassword: "Confirm Password",
        resetButton: "Reset Password",
        resetSuccess: "Your password has been reset successfully. You can now log in.",
        invalidToken: "This reset link is invalid or has expired. Please request a new one.",
        passwordMismatch: "Passwords do not match.",
        goToLogin: "Go to Login"
      },
      adminCommunications: {
        title: "Communications",
        subtitle: "Manage email settings and notifications for the platform",
        configSaved: "Email configuration saved successfully",
        configError: "Failed to save email configuration",
        tabs: {
          settings: "Settings",
          templates: "Templates",
          logs: "Send History",
          stats: "Statistics"
        },
        provider: {
          title: "Email Provider",
          description: "Configure your email service provider",
          service: "Service Provider",
          status: "Connection Status",
          statusHint: "Gmail integration status",
          connected: "Connected",
          notConfigured: "Not Configured",
          setupHint: "Connect your Gmail account to enable email sending. Click the integrations panel to set up."
        },
        sender: {
          title: "Sender Settings",
          description: "Configure sender information for outgoing emails",
          name: "Sender Name",
          email: "Sender Email",
          replyTo: "Reply-To Email"
        },
        categories: {
          title: "Email Categories",
          description: "Enable or disable different types of email communications",
          functional: "Functional",
          functionalDesc: "Password reset, confirmations",
          transactional: "Transactional",
          transactionalDesc: "Quote updates, bid notifications",
          marketing: "Marketing",
          marketingDesc: "Promotions, newsletters"
        },
        templates: {
          title: "Email Templates",
          description: "Manage email templates for different notifications",
          passwordReset: "Password Reset",
          quoteReceived: "Quote Received",
          bidSubmitted: "Bid Submitted",
          bidAccepted: "Bid Accepted",
          moveReminder: "Move Reminder",
          welcome: "Welcome Email"
        },
        logs: {
          title: "Email History",
          description: "View sent emails and their delivery status",
          empty: "No emails have been sent yet"
        },
        stats: {
          total: "Total Emails",
          sent: "Sent",
          pending: "Pending",
          failed: "Failed"
        }
      },
      onboarding: {
        title: "Become a Partner",
        subtitle: "Complete your profile to start receiving move requests",
        success: "Account created successfully! Welcome to U-Storage Go.",
        back: "Back",
        next: "Continue",
        submit: "Complete Registration",
        loginPrompt: "Already have an account?",
        loginLink: "Sign in here",
        steps: {
          company: "Company",
          fleet: "Fleet",
          areas: "Coverage",
          contact: "Contact",
          account: "Account"
        },
        company: {
          title: "Tell us about your company",
          subtitle: "Basic information about your moving business",
          name: "Company Name",
          namePlaceholder: "Mudanzas Express S.A.",
          description: "Description",
          descriptionPlaceholder: "Tell customers what makes your company special...",
          years: "Years in Business",
          taxId: "Tax ID (RFC)"
        },
        fleet: {
          title: "Your Fleet & Services",
          subtitle: "What resources do you have available?",
          size: "Number of Vehicles",
          crew: "Team Members",
          vehicleTypes: "Vehicle Types",
          moveTypes: "Types of Moves You Offer"
        },
        areas: {
          title: "Service Coverage",
          subtitle: "Where do you operate?",
          coverage: "Service Areas",
          placeholder: "Mexico City, Guadalajara, Monterrey...",
          hint: "Separate cities or regions with commas",
          hours: "Operating Hours",
          hoursPlaceholder: "Mon-Fri 8am-6pm, Sat 9am-2pm"
        },
        contact: {
          title: "Contact Information",
          subtitle: "How can customers reach you?",
          phone: "Phone Number",
          whatsapp: "WhatsApp",
          email: "Business Email",
          website: "Website"
        },
        account: {
          title: "Create Your Account",
          subtitle: "Set up your login credentials",
          confirm: "Confirm Password",
          mismatch: "Passwords do not match"
        },
        moveTypes: {
          local: "Local Moves",
          longDistance: "Long Distance",
          commercial: "Commercial/Office",
          residential: "Residential",
          packing: "Packing Services",
          storage: "Storage",
          specialItems: "Special Items",
          international: "International"
        },
        vehicleTypes: {
          van: "Van",
          smallTruck: "Small Truck",
          mediumTruck: "Medium Truck",
          largeTruck: "Large Truck",
          trailer: "Trailer",
          motorcycle: "Motorcycle"
        }
      },
      roles: {
        user: {
          title: "For Customers",
          desc: "Get quotes, book your move, and manage your relocation."
        },
        mover: {
          title: "For Movers",
          desc: "Find jobs, manage your fleet, and grow your business."
        },
        admin: {
          title: "Administration",
          desc: "Platform management and oversight."
        }
      },
      servicesPage: {
        title: "Moving and storage, connected",
        subtitle: "U-Storage provides the space. U-Storage Go coordinates the move.",
        items: {
          local: {
            title: "Moving Services",
            desc: "Quote and coordinate your move with verified crews for each service."
          },
          storage: {
            title: "U-Storage Units",
            desc: "Secure short-term and long-term storage in U-Storage facilities, coordinated with your move."
          }
        },
        valueProps: {
          title: "Why U-Storage Go?",
          subtitle: "We move what you value, we care for what matters",
          crews: {
            title: "Verified crews",
            desc: "Know who will perform your service and receive clear information before confirming."
          },
          care: {
            title: "We Care for What Matters",
            desc: "Behind every box are memories and projects. We coordinate every service with that responsibility in mind."
          },
          digital: {
            title: "Everything from Your Phone",
            desc: "Request your estimate, organize your inventory, and review your service information from one place."
          },
          clarity: {
            title: "No Surprises",
            desc: "Review an initial estimate and the scope of your service before confirming."
          }
        }
      },
      aboutPage: {
        title: "About Us",
        subtitle: "Storage space and moving coordination in one experience",
        mission: {
          title: "Our Mission",
          desc: "To simplify the moving process by providing transparency, trust, and technology."
        },
        values: {
          title: "Our Values",
          trust: "Trust & Safety",
          transparency: "Transparency",
          innovation: "Innovation"
        },
        story: {
          title: "Our Story",
          desc: "U-Storage Go was born from U-Storage to connect two needs that often happen together: moving your belongings and finding space to store them.\n\nU-Storage provides storage units. U-Storage Go coordinates your move and the connection between both services, so you can plan everything through one experience.\n\nTrust begins with clear information: an initial estimate based on your needs, verified crews, and protection options confirmed according to each service.\n\nYour move and your storage, in one place. We move what you value, and we care for what matters."
        }
      },
      quote: {
        title: "Get your moving quote",
        summary: "Summary",
        disclaimer: "By clicking submit, you agree to share your details with our team so we can prepare your quote.",
        steps: {
          details: "Move Details",
          inventory: "Inventory",
          services: "Additional Services",
          review: "Review",
          account: "Create Account"
        },
        preliminary: {
          title: "Preliminary Estimate",
          range: "$350 - $550",
          message: "This is a preliminary estimate based on your details. To receive a finalized quote from our team shortly, please create an account.",
          createAccount: "Create Account",
          subtitle: "Save your quote and get your final price"
        },
        submitSuccess: "Your quote request has been submitted successfully! Our team will review it and confirm your quote soon.",
        form: {
          from: "Moving From (Full Address)",
          to: "Moving To (Full Address)",
          date: "Preferred Date",
          size: "Home Size",
          fromLabel: "From",
          toLabel: "To",
          dateLabel: "Date",
          sizeLabel: "Size",
          name: "Full Name",
          email: "Email",
          password: "Password",
          sizes: {
            studio: "Studio / 1 Room",
            small: "1-2 Bedrooms",
            medium: "3-4 Bedrooms",
            large: "5+ Bedrooms",
            office: "Office / Commercial"
          },
          storage: {
            label: "Storage Needs",
            question: "Do you need storage or are you moving to/from a storage unit?",
            options: {
              none: "No, just moving",
              need: "I need to rent a storage unit",
              ustorage: "I'm moving in/out of u-Storage",
              other: "I have a unit at another facility"
            }
          },
          addons: {
            title: "Additional Services",
            insurance: "Moving Insurance",
            insuranceDesc: "Protect your belongings against damage or loss",
            packing: "Packing Service",
            packingDesc: "Professional packing for all your items",
            unpacking: "Unpacking Service",
            unpackingDesc: "Help unpacking and organizing at your new home",
            box: "Moving Boxes",
            boxDesc: "High-quality boxes and packing materials"
          },
          validation: {
            required: "Required",
            email: "Invalid email",
            minChars: "String must contain at least {{count}} character(s)"
          },
          next: "Next Step",
          back: "Back",
          submit: "Get Estimates",
          createAndSubmit: "Create Account & Request Final Quote",
          submitQuote: "Submit Quote Request"
        },
        stepOf: "Step {{current}} of {{total}}",
        chat: {
          intro: "Hi! I'm Clara, your AI moving assistant. I'll help you create your inventory. Let's start with the Living Room - what large furniture do you have there?",
          placeholder: "Type your message...",
          responses: {
            sofa: "Got it, added a sofa. Anything else in the living room?",
            tv: "Added the TV. Do you have a TV stand as well?",
            bed: "Noted, one bed. Is it a King, Queen, or Twin?",
            table: "Dining table added. How many chairs?",
            finish: "Great! Please review your inventory list on the right.",
            default: "I've noted that down. What else?"
          }
        },
        summaryPanel: {
          byRoom: "By Room",
          byType: "By Type",
          items: "Items",
          rooms: {
            "Living Room": "Living Room",
            "Bedroom": "Bedroom",
            "Kitchen": "Kitchen",
            "Dining Room": "Dining Room"
          },
          categories: {
            "Furniture": "Furniture",
            "Electronics": "Electronics",
            "Boxes": "Boxes"
          },
          itemsList: {
            "Sofa": "Sofa",
            "TV Stand": "TV Stand",
            "TV": "TV",
            "Queen Bed": "Queen Bed",
            "Bed": "Bed",
            "Dining Table": "Dining Table",
            "Boxes (L)": "Boxes (L)"
          }
        }
      },
      dashboard: {
        client: {
          title: "Dashboard",
          welcome: "Welcome back",
          activeMoves: "Active Moves",
          activeMovesSub: "Scheduled for next week",
          pendingQuotes: "Pending Quotes",
          pendingQuotesSub: "All up to date",
          completedMoves: "Completed Moves",
          completedMovesSub: "Successfully delivered",
          savedAddresses: "Saved Addresses",
          savedAddressesSub: "Home & Office",
          recentActivity: "Recent Activity",
          noRecentActivity: "No recent activity",
          myMoves: "My Moves",
          noActiveMoves: "No active moves found",
          noCompletedMoves: "No completed moves yet",
          addAddress: "Add Address",
          quotes: "Quotes",
          allQuotes: "All Quotes",
          noQuotes: "No quotes yet. Get started with your first quote!",
          profile: "Profile",
          settings: "Settings",
          nav: {
            overview: "Dashboard",
            moves: "My Moves",
            quotes: "Quotes",
            saved: "Saved Addresses"
          }
        },
        mover: {
          title: "Mover Dashboard",
          welcome: "Welcome back, FastMoves Inc.",
          newQuote: "New Quote Request",
          activeJobs: "Active Jobs",
          activeJobsSub: "+2 from last week",
          pendingQuotes: "Pending Quotes",
          pendingQuotesSub: "Requires attention",
          revenue: "Revenue",
          revenueSub: "+10.1% from last month",
          drivers: "Drivers",
          driversSub: "Active now",
          jobsPlaceholder: "List of active jobs will appear here",
          quotesPlaceholder: "Quote requests management interface",
          fleetPlaceholder: "Vehicle fleet overview and status",
          driversPlaceholder: "Driver roster and schedules",
          nav: {
            overview: "Dashboard",
            profile: "Profile",
            jobs: "Active Jobs",
            quotes: "Quotes",
            fleet: "Fleet",
            drivers: "Drivers"
          },
          profile: {
            title: "Company Profile",
            verified: "Verified",
            pending: "Pending Verification",
            company: "Company Information",
            contact: "Contact Details",
            fleet: "Fleet & Crew",
            services: "Services & Coverage",
            years: "years",
            noProfile: "No profile information found",
            complete: "Complete Profile",
            edit: "Edit",
            editTitle: "Edit Profile",
            updateSuccess: "Profile updated successfully",
            updateError: "Failed to update profile",
            noContact: "No contact information added yet",
            noFleet: "No fleet information added yet",
            noServices: "No services added yet"
          }
        },
        admin: {
          title: "Admin Portal",
          welcome: "Platform administration overview",
          subtitle: "Platform Overview",
          emergencyStop: "Emergency Stop",
          totalQuotes: "Total Quotes",
          totalQuotesSub: "+12 from last week",
          activeUsers: "Active Users",
          activeUsersSub: "+5% growth",
          activeMovers: "Active Movers",
          activeMoversSub: "Verified partners",
          revenue: "Revenue",
          revenueSub: "+8.2% from last month",
          recentQuotes: "Recent Quotes",
          pendingApprovals: "Pending Approvals",
          quotesPlaceholder: "All quotes will appear here",
          approvalsPlaceholder: "Mover verification requests",
          allQuotes: "All Quotes",
          allUsers: "All Users",
          usersPlaceholder: "User management interface",
          allMovers: "All Movers",
          moversPlaceholder: "Mover partners management",
          settingsDesc: "Platform configuration",
          settingsPlaceholder: "Platform settings and configuration",
          nav: {
            overview: "Overview",
            quotes: "Quotes",
            partners: "Partners",
            movers: "Movers",
            users: "Users",
            verification: "Verification",
            settings: "Settings"
          },
          status: {
            active: "Active",
            inactive: "Inactive"
          },
          admins: {
            title: "Admin Access Control",
            description: "Manage platform administrators and their permission levels",
            add: "Add New Admin",
            addDescription: "Add a new administrator to the platform. They will receive an email to set their password.",
            addButton: "Add Admin",
            selectRole: "Select a role",
            table: {
              name: "Name",
              email: "Email",
              role: "Role",
              status: "Status",
              actions: "Actions"
            },
            roles: {
              super: "Super Admin",
              support: "Support",
              viewer: "Viewer"
            }
          },
          partners: {
            title: "Partners Management",
            subtitle: "Partner Companies",
            description: "View and manage all registered moving companies and their onboarding status",
            empty: "No partners registered yet",
            vehicles: "vehicles",
            crew: "crew members",
            add: "New Partner",
            newPartnerTitle: "Register New Partner",
            newPartnerDescription: "Add a new moving company partner to the platform",
            create: "Create Partner",
            createSuccess: "Partner created successfully",
            createError: "Error creating partner",
            form: {
              userInfo: "Contact Person",
              companyInfo: "Company Information",
              fullName: "Full Name",
              email: "Email",
              phone: "Phone",
              companyName: "Company Name",
              businessEmail: "Business Email",
              contactPhone: "Contact Phone",
              taxId: "RFC (Tax ID)",
              fleetSize: "Fleet Size",
              crewSize: "Crew Size"
            },
            table: {
              company: "Company",
              contact: "Contact",
              fleet: "Fleet",
              services: "Services",
              status: "Status",
              actions: "Actions"
            },
            status: {
              verified: "Verified",
              pending: "Pending Verification",
              profileComplete: "Profile Complete",
              inProgress: "In Progress",
              started: "Started"
            }
          },
          users: {
            title: "User Management",
            sectionTitle: "User Management",
            newRegistrations: "New Registrations (Today)",
            totalUsers: "Total Users",
            manage: "Manage Users",
            add: "New User",
            newUserTitle: "Create New User",
            newUserDescription: "Add a new user to the platform",
            create: "Create User",
            createSuccess: "User created successfully",
            createError: "Error creating user",
            form: {
              fullName: "Full Name",
              email: "Email",
              phone: "Phone",
              userType: "User Type"
            },
            types: {
              client: "Client",
              mover: "Mover",
              admin: "Administrator"
            }
          },
          verification: {
            title: "Verification Queue",
            sectionTitle: "Verification Center",
            pendingMovers: "Pending Mover Approvals",
            documentReviews: "Document Reviews",
            review: "Review Queue"
          },
          settings: {
            title: "System Settings",
            placeholder: "Platform configuration"
          }
        }
      },
      quotes: {
        status: {
          intake: "Received",
          triage: "Under Review",
          bidding_open: "Collecting Bids",
          selection: "Selecting Mover",
          confirmed: "Confirmed",
          scheduled: "Scheduled",
          completed: "Completed",
          cancelled: "Cancelled"
        },
        admin: {
          title: "Quotes Management",
          subtitle: "Quote Requests",
          description: "View and manage customer quote requests through the bidding lifecycle",
          empty: "No quotes found",
          items: "items",
          bidsReceived: "bids",
          invited: "invited",
          updateSuccess: "Quote updated successfully",
          biddingOpened: "Bidding opened for partners",
          partnerInvited: "Partner invited successfully",
          bidAccepted: "Bid accepted, partner assigned",
          quoteDetails: "Quote Details",
          createdAt: "Created",
          customer: "Customer",
          route: "Route",
          moveDate: "Move Date",
          dateNotSet: "Date not set",
          homeSize: "Home Size",
          inventory: "Inventory",
          noInventory: "No inventory items",
          services: "Services",
          addOns: "Add-ons",
          pricing: "Pricing",
          suggestedPrice: "Suggested Price",
          finalPrice: "Final Price",
          notes: "Admin Notes",
          notesPlaceholder: "Add internal notes about this quote...",
          bids: "Bids",
          noBids: "No bids submitted yet",
          crew: "crew",
          acceptBid: "Accept",
          invitedPartners: "Invited Partners",
          noInvitations: "No partners invited yet",
          invitePartner: "Invite Partner",
          alreadyInvited: "Invited",
          invite: "Invite",
          vehicles: "vehicles",
          noVerifiedPartners: "No verified partners available",
          assignedPartner: "Assigned Partner",
          startReview: "Start Review",
          openBidding: "Open Bidding",
          closeBidding: "Close Bidding",
          openBiddingTitle: "Open Bidding",
          openBiddingDescription: "Set a suggested price to guide partner bids for this quote",
          startBidding: "Start Bidding",
          invitePartnerTitle: "Invite Partner",
          invitePartnerDescription: "Select a verified partner to invite to bid on this quote",
          table: {
            customer: "Customer",
            route: "Route",
            date: "Date",
            items: "Items",
            bids: "Bids",
            status: "Status",
            actions: "Actions"
          },
          newQuote: "New Quote",
          newQuoteTitle: "Create New Quote",
          newQuoteDescription: "Manually enter a new quote request for a customer",
          createQuote: "Create Quote",
          createSuccess: "Quote created successfully",
          createError: "Error creating quote",
          form: {
            customerName: "Customer Name",
            customerEmail: "Customer Email",
            customerPhone: "Customer Phone",
            fromAddress: "From Address",
            toAddress: "To Address",
            moveDate: "Move Date",
            homeSize: "Home Size",
            storageOption: "Storage Option",
            notes: "Notes",
            notesPlaceholder: "Additional details about the move...",
            homeSizes: {
              studio: "Studio",
              "1bed": "1 Bedroom",
              "2bed": "2 Bedrooms",
              "3bed": "3 Bedrooms",
              "4bed": "4+ Bedrooms",
              house: "House",
              office: "Office"
            },
            storage: {
              none: "No Storage",
              short: "Short-term Storage",
              long: "Long-term Storage"
            }
          }
        },
        mover: {
          title: "Quote Opportunities",
          subtitle: "Quote Requests",
          description: "View quote invitations and submit your bids",
          noInvitations: "No quote invitations at this time",
          noBids: "You haven't submitted any bids yet",
          unknownLocation: "Location not specified",
          dateNotSet: "Date not set",
          items: "items",
          quoteDetails: "Quote Details",
          invitedAt: "Invited",
          route: "Route",
          moveDate: "Move Date",
          homeSize: "Home Size",
          inventory: "Inventory",
          noInventory: "No inventory details",
          suggestedPrice: "Suggested Price",
          noPriceSuggested: "No price suggested",
          suggestedPriceNote: "You can bid below or above this amount",
          adminMessage: "Message from Admin",
          respondBy: "Respond by",
          submitBid: "Submit Bid",
          decline: "Decline",
          invitationDeclined: "Invitation declined",
          bidSubmitted: "Bid submitted successfully",
          bidAlreadySubmitted: "You have already submitted a bid for this quote",
          submitBidTitle: "Submit Your Bid",
          submitBidDescription: "Enter your pricing and availability for this job",
          bidAmount: "Your Bid Amount",
          estimatedHours: "Estimated Hours",
          crewSize: "Crew Size",
          bidNotes: "Notes",
          bidNotesPlaceholder: "Add any details about your bid (optional)...",
          adjustmentReason: "Reason for price change",
          adjustmentReasonPlaceholder: "Explain why you're changing the price...",
          adjustmentReasonHelp: "Since your bid differs from the suggested price, please explain why",
          adjustmentReasonRequired: "Please explain why you're changing the price",
          confirmBid: "Submit Bid",
          withdrawBid: "Withdraw",
          bidWithdrawn: "Bid withdrawn",
          crew: "crew",
          tabs: {
            invitations: "Invitations",
            myBids: "My Bids"
          },
          status: {
            new: "New",
            viewed: "Viewed",
            bidSubmitted: "Bid Submitted",
            declined: "Declined",
            expired: "Expired"
          },
          bidStatus: {
            submitted: "Pending",
            accepted: "Accepted",
            rejected: "Rejected",
            withdrawn: "Withdrawn"
          }
        }
      },
      footer: {
        description: "Your move and your storage, in one place. U-Storage Go connects moving coordination with U-Storage units.",
        quickLinks: "Quick Links",
        company: "Company",
        contact: "Contact Us",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        rights: "All rights reserved."
      }
    }
  },
  es: {
    translation: {
      nav: {
        home: "Inicio",
        services: "Servicios",
        about: "Nosotros",
        login: "Clientes",
        partners: "Socios",
        admin: "Admin",
        moverLogin: "Portal Transportista",
        adminLogin: "Portal Admin",
        getQuote: "Cotizar"
      },
      common: {
        email: "Correo Electrónico",
        password: "Contraseña",
        businessEmail: "Correo Corporativo",
        clickHere: "Clic aquí",
        partnership: "En alianza con",
        forgotPassword: "¿Olvidaste tu contraseña?",
        error: "Error",
        success: "Éxito",
        loading: "Cargando...",
        save: "Guardar",
        cancel: "Cancelar",
        close: "Cerrar",
        phone: "Teléfono",
        view: "Ver",
        viewAll: "Ver Todo",
        noneSelected: "Ninguno seleccionado"
      },
      login: {
        success: "¡Bienvenido de vuelta!",
        subtitle: "Inicia sesión para gestionar tus mudanzas",
        continueWith: "Continuar con Red Social",
        providers: "Inicio de sesión seguro con tu proveedor favorito",
        tabLogin: "Iniciar Sesión",
        tabSignup: "Registrarse",
        welcomeBack: "Bienvenido de Nuevo",
        createAccount: "Crear Cuenta",
        signupSubtitle: "Comienza tu experiencia de mudanza con nosotros",
        signupWith: "Registrarse con Red Social",
        signInEmail: "Iniciar con Email",
        createAccountBtn: "Crear Cuenta",
        fullName: "Nombre Completo",
        passwordHint: "Mínimo 6 caracteres",
        signupSuccess: "¡Cuenta creada exitosamente!",
        or: "o",
        error: {
          required: "Por favor ingresa tu correo y contraseña",
          invalid: "Correo o contraseña inválidos",
          allFieldsRequired: "Por favor completa todos los campos",
          passwordLength: "La contraseña debe tener al menos 6 caracteres",
          registration: "Error en el registro"
        }
      },
      hero: {
        title: "Ahora no solo guardamos tus cosas. También te ayudamos a llevarlas",
        subtitle: "Cotiza un traslado que comience o termine en una sucursal U-Storage participante.",
        ctaUser: "Cotizar mudanza + bodega",
        ctaMover: "Soy transportista",
        ctaAdmin: "Acceso Admin",
        trusted: "Mudanza y bodega, conectadas",
        instantQuote: "Cotiza tu mudanza",
        comparePrices: "Recibe un estimado inicial en minutos",
        movesThisMonth: "Mudanzas este mes",
        rating: "Calificación",
        features: {
          insured: "Protección disponible según servicio",
          verified: "Equipos verificados",
          rates: "Estimado inicial claro"
        },
        howItWorks: {
          title: "Cómo funciona U-Storage Go",
          step1: { title: "Cuéntanos qué necesitas", desc: "Indica qué vas a mover, guardar y a dónde debe llegar." },
          step2: { title: "Recibe tu estimado", desc: "Obtén un estimado inicial claro con base en tu información." },
          step3: { title: "Coordina ambos servicios", desc: "Confirma tu mudanza y conéctala con U-Storage si necesitas espacio." }
        }
      },
      adminLanding: {
        badge: "Administración",
        title: "Centro de Control de Plataforma",
        subtitle: "Acceso seguro para administradores de U-Storage Go. Gestiona usuarios, socios y configuraciones de la plataforma.",
        features: {
          analytics: "Analíticas en Tiempo Real",
          management: "Gestión de Plataforma"
        },
        login: {
          title: "Acceso Administrador",
          subtitle: "Ingresa tus credenciales para acceder al portal",
          email: "Correo Electrónico",
          password: "Contraseña",
          button: "Acceder al Panel",
          forgot: "¿Olvidaste tu contraseña?"
        },
        signup: {
          title: "Registro de Administrador",
          subtitle: "Crea tu cuenta de administrador",
          button: "Crear Cuenta de Admin"
        },
        error: {
          notAdmin: "Esta cuenta no está autorizada para acceso de administrador"
        },
        securityNote: "El acceso de administrador está restringido solo a personal autorizado.",
        noAccount: "¿No tienes una cuenta de administrador?",
        requestAccess: "Solicitar Acceso de Admin",
        request: {
          title: "Solicitar Acceso de Admin",
          description: "Envía tu solicitud para convertirte en administrador. Un super administrador revisará tu aplicación.",
          sentTitle: "Solicitud Enviada",
          sentDescription: "Tu solicitud ha sido enviada para revisión.",
          namePlaceholder: "Tu Nombre Completo",
          company: "Empresa/Organización",
          companyPlaceholder: "Nombre de tu empresa",
          justification: "¿Por qué necesitas acceso de admin?",
          justificationPlaceholder: "Explica brevemente tu rol y por qué necesitas acceso de administrador...",
          submit: "Enviar Solicitud",
          success: "¡Tu solicitud ha sido enviada exitosamente!",
          successMessage: "Tu solicitud ha sido enviada. Un super administrador la revisará y recibirás un correo cuando sea aprobada.",
          error: {
            required: "Por favor ingresa tu nombre y correo"
          }
        }
      },
      forgotPassword: {
        link: "¿Olvidaste tu contraseña?",
        title: "Restablecer Contraseña",
        sentTitle: "Revisa tu Correo",
        description: "Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.",
        sentDescription: "Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer tu contraseña.",
        emailRequired: "Por favor ingresa tu correo electrónico",
        sendButton: "Enviar Enlace",
        checkEmail: "Revisa tu bandeja de entrada para el enlace de restablecimiento. El enlace expira en 1 hora.",
        backToLogin: "Volver al Inicio de Sesión",
        error: "No pudimos procesar tu solicitud. Por favor intenta de nuevo.",
        success: "Si existe una cuenta con ese correo, se ha enviado un enlace de restablecimiento.",
        resetTitle: "Nueva Contraseña",
        resetDescription: "Ingresa tu nueva contraseña abajo.",
        newPassword: "Nueva Contraseña",
        confirmPassword: "Confirmar Contraseña",
        resetButton: "Restablecer Contraseña",
        resetSuccess: "Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.",
        invalidToken: "Este enlace es inválido o ha expirado. Por favor solicita uno nuevo.",
        passwordMismatch: "Las contraseñas no coinciden.",
        goToLogin: "Ir a Iniciar Sesión"
      },
      adminCommunications: {
        title: "Comunicaciones",
        subtitle: "Administra la configuración de correos y notificaciones de la plataforma",
        configSaved: "Configuración de correo guardada exitosamente",
        configError: "Error al guardar la configuración de correo",
        tabs: {
          settings: "Configuración",
          templates: "Plantillas",
          logs: "Historial",
          stats: "Estadísticas"
        },
        provider: {
          title: "Proveedor de Correo",
          description: "Configura tu proveedor de servicio de correo",
          service: "Proveedor de Servicio",
          status: "Estado de Conexión",
          statusHint: "Estado de integración con Gmail",
          connected: "Conectado",
          notConfigured: "No Configurado",
          setupHint: "Conecta tu cuenta de Gmail para habilitar el envío de correos. Haz clic en el panel de integraciones para configurar."
        },
        sender: {
          title: "Configuración del Remitente",
          description: "Configura la información del remitente para correos salientes",
          name: "Nombre del Remitente",
          email: "Correo del Remitente",
          replyTo: "Correo de Respuesta"
        },
        categories: {
          title: "Categorías de Correo",
          description: "Habilita o deshabilita diferentes tipos de comunicaciones por correo",
          functional: "Funcionales",
          functionalDesc: "Restablecimiento de contraseña, confirmaciones",
          transactional: "Transaccionales",
          transactionalDesc: "Actualizaciones de cotizaciones, notificaciones de ofertas",
          marketing: "Marketing",
          marketingDesc: "Promociones, boletines"
        },
        templates: {
          title: "Plantillas de Correo",
          description: "Administra las plantillas de correo para diferentes notificaciones",
          passwordReset: "Restablecimiento de Contraseña",
          quoteReceived: "Cotización Recibida",
          bidSubmitted: "Oferta Enviada",
          bidAccepted: "Oferta Aceptada",
          moveReminder: "Recordatorio de Mudanza",
          welcome: "Correo de Bienvenida"
        },
        logs: {
          title: "Historial de Correos",
          description: "Ver correos enviados y su estado de entrega",
          empty: "Aún no se han enviado correos"
        },
        stats: {
          total: "Total de Correos",
          sent: "Enviados",
          pending: "Pendientes",
          failed: "Fallidos"
        }
      },
      onboarding: {
        title: "Conviértete en Socio",
        subtitle: "Completa tu perfil para empezar a recibir solicitudes de mudanza",
        success: "¡Cuenta creada exitosamente! Bienvenido a U-Storage Go.",
        back: "Atrás",
        next: "Continuar",
        submit: "Completar Registro",
        loginPrompt: "¿Ya tienes una cuenta?",
        loginLink: "Inicia sesión aquí",
        steps: {
          company: "Empresa",
          fleet: "Flota",
          areas: "Cobertura",
          contact: "Contacto",
          account: "Cuenta"
        },
        company: {
          title: "Cuéntanos sobre tu empresa",
          subtitle: "Información básica de tu negocio de mudanzas",
          name: "Nombre de la Empresa",
          namePlaceholder: "Mudanzas Express S.A.",
          description: "Descripción",
          descriptionPlaceholder: "Cuéntales a los clientes qué hace especial a tu empresa...",
          years: "Años en el Negocio",
          taxId: "RFC (Registro Federal de Contribuyentes)"
        },
        fleet: {
          title: "Tu Flota y Servicios",
          subtitle: "¿Qué recursos tienes disponibles?",
          size: "Número de Vehículos",
          crew: "Miembros del Equipo",
          vehicleTypes: "Tipos de Vehículos",
          moveTypes: "Tipos de Mudanzas que Ofreces"
        },
        areas: {
          title: "Cobertura de Servicio",
          subtitle: "¿Dónde operas?",
          coverage: "Áreas de Servicio",
          placeholder: "Ciudad de México, Guadalajara, Monterrey...",
          hint: "Separa ciudades o regiones con comas",
          hours: "Horario de Operación",
          hoursPlaceholder: "Lun-Vie 8am-6pm, Sáb 9am-2pm"
        },
        contact: {
          title: "Información de Contacto",
          subtitle: "¿Cómo pueden contactarte los clientes?",
          phone: "Número de Teléfono",
          whatsapp: "WhatsApp",
          email: "Correo Empresarial",
          website: "Sitio Web"
        },
        account: {
          title: "Crea tu Cuenta",
          subtitle: "Configura tus credenciales de acceso",
          confirm: "Confirmar Contraseña",
          mismatch: "Las contraseñas no coinciden"
        },
        moveTypes: {
          local: "Mudanzas Locales",
          longDistance: "Larga Distancia",
          commercial: "Comercial/Oficina",
          residential: "Residencial",
          packing: "Servicios de Empaque",
          storage: "Almacenamiento",
          specialItems: "Artículos Especiales",
          international: "Internacional"
        },
        vehicleTypes: {
          van: "Camioneta",
          smallTruck: "Camión Pequeño",
          mediumTruck: "Camión Mediano",
          largeTruck: "Camión Grande",
          trailer: "Tráiler",
          motorcycle: "Moto"
        }
      },
      partners: {
        hero: {
          badge: "Para Profesionales de Mudanzas",
          title: "Haz crecer tu negocio con U-Storage Go",
          subtitle: "Trabaja con U-Storage Go. Obtén trabajos de mudanza de alta calidad, gestiona tu operación eficientemente y recibe pagos más rápido.",
          cta: "Convertirse en Socio",
          existing: "¿Ya eres socio?"
        },
        login: {
          button: "Acceso Socios",
          link: "Inicia sesión aquí",
          welcome: "Bienvenido de Nuevo, Socio",
          subtitle: "Accede a tu panel de socio"
        },
        signup: {
          title: "Únete a Nuestra Red",
          subtitle: "Comienza a hacer crecer tu negocio de mudanzas",
          button: "Crear Cuenta de Socio"
        },
        benefits: {
          title: "¿Por qué asociarse con nosotros?",
          subtitle: "Proporcionamos las herramientas y clientes que necesitas para triunfar",
          1: {
            title: "Clientes Calificados",
            desc: "Deja de perseguir clientes fríos. Recibe solicitudes verificadas con alta intención directamente en tu panel."
          },
          2: {
            title: "Gestión Inteligente",
            desc: "Gestiona tu flota, agenda y equipo desde una plataforma intuitiva y compatible con móviles."
          },
          3: {
            title: "Seguimiento claro de pagos",
            desc: "Consulta el estado de tus servicios y pagos desde tu panel de socio."
          }
        },
        cta: {
          title: "¿Listo para escalar tu negocio?",
          subtitle: "Únete a la red de socios U-Storage Go y recibe oportunidades de mudanza acordes con tu cobertura."
        }
      },
      clients: {
        hero: {
          badge: "Para Clientes",
          title: "Relájate, nosotros nos encargamos",
          subtitle: "Rastrea tu mudanza, gestiona documentos y comunícate con tus transportistas, todo en un solo lugar.",
          cta: "Cotizar Ahora",
          existing: "¿Ya tienes una cuenta?"
        },
        login: {
          button: "Acceso Clientes",
          link: "Inicia sesión aquí"
        },
        benefits: {
          title: "Tu mudanza, simplificada",
          subtitle: "Todo lo que necesitas para un traslado sin estrés",
          1: {
            title: "Equipos Profesionales",
            desc: "Tu servicio se asigna a un equipo verificado, con información disponible antes de confirmar."
          },
          2: {
            title: "Precios Transparentes",
            desc: "Recibe un estimado inicial claro y revisa el alcance final del servicio antes de confirmar."
          },
          3: {
            title: "Opciones de protección",
            desc: "Consulta las condiciones de protección disponibles para tu servicio antes de confirmar."
          }
        },
        cta: {
          title: "¿Listo para mudarte o liberar espacio?",
          subtitle: "Solicita un estimado inicial para tu mudanza y conéctala con U-Storage cuando necesites bodega."
        }
      },
      roles: {
        user: {
          title: "Para Clientes",
          desc: "Obtén cotizaciones, reserva mudanzas y gestiona tu traslado."
        },
        mover: {
          title: "Para Transportistas",
          desc: "Encuentra trabajos, gestiona tu flota y haz crecer tu negocio."
        },
        admin: {
          title: "Administración",
          desc: "Gestión y supervisión de la plataforma."
        }
      },
      servicesPage: {
        title: "Mudanza y bodega, conectadas",
        subtitle: "U-Storage ofrece el espacio. U-Storage Go coordina la mudanza.",
        items: {
          local: {
            title: "Mudanzas",
            desc: "Cotiza y coordina tu mudanza con equipos verificados para cada servicio."
          },
          storage: {
            title: "Bodegas U-Storage",
            desc: "Almacenamiento seguro a corto y largo plazo en instalaciones U-Storage, coordinado con tu mudanza."
          }
        },
        valueProps: {
          title: "¿Por qué U-Storage Go?",
          subtitle: "Movemos lo que valoras, cuidamos lo que importa",
          crews: {
            title: "Equipos verificados",
            desc: "Sabes quién realizará tu servicio y recibes información clara antes de confirmar."
          },
          care: {
            title: "Cuidamos lo que importa",
            desc: "Detrás de cada caja hay recuerdos y proyectos. Coordinamos cada servicio con esa responsabilidad en mente."
          },
          digital: {
            title: "Todo desde tu celular",
            desc: "Solicita tu estimado, organiza tu inventario y consulta la información de tu servicio desde un solo lugar."
          },
          clarity: {
            title: "Sin sorpresas",
            desc: "Revisa un estimado inicial y el alcance de tu servicio antes de confirmar."
          }
        }
      },
      aboutPage: {
        title: "Sobre Nosotros",
        subtitle: "Espacio para guardar y coordinación para mover, en una sola experiencia",
        mission: {
          title: "Nuestra Misión",
          desc: "Simplificar el proceso de mudanza proporcionando transparencia, confianza y tecnología."
        },
        values: {
          title: "Nuestros Valores",
          trust: "Confianza y Seguridad",
          transparency: "Transparencia",
          innovation: "Innovación"
        },
        story: {
          title: "Nuestra Historia",
          desc: "U-Storage Go nace de U-Storage para conectar dos necesidades que suelen ocurrir juntas: mover tus cosas y encontrar espacio para guardarlas.\n\nU-Storage ofrece las bodegas. U-Storage Go coordina la mudanza y la conexión entre ambos servicios, para que puedas planear todo desde una sola experiencia.\n\nLa confianza empieza con información clara: un estimado inicial basado en tus necesidades, equipos verificados y opciones de protección confirmadas según cada servicio.\n\nTu mudanza y tu bodega, en un solo lugar. Movemos lo que valoras, cuidamos lo que importa."
        }
      },
      quote: {
        title: "Cotiza tu mudanza",
        summary: "Resumen",
        disclaimer: "Al hacer clic en enviar, aceptas compartir tus detalles con nuestro equipo para preparar tu cotización.",
        steps: {
          details: "Detalles",
          inventory: "Inventario",
          services: "Servicios Adicionales",
          review: "Revisar",
          account: "Crear Cuenta"
        },
        preliminary: {
          title: "Estimación Preliminar",
          range: "",
          message: "Esta es una estimación preliminar basada en sus detalles. Para recibir una cotización finalizada por nuestro equipo, te invitamos a crear una cuenta para poderle dar mejor seguimiento a tu cotización y tu servicio.",
          createAccount: "Crear Cuenta",
          subtitle: "Guarda tu cotización y recibe tu precio final"
        },
        submitSuccess: "¡Tu solicitud de cotización ha sido enviada exitosamente! Nuestro equipo la revisará y confirmará tu cotización pronto.",
        form: {
          from: "Origen (Dirección Completa)",
          to: "Destino (Dirección Completa)",
          date: "Fecha Preferida",
          size: "Tamaño del Hogar",
          fromLabel: "Desde",
          toLabel: "Hasta",
          dateLabel: "Fecha",
          sizeLabel: "Tamaño",
          name: "Nombre Completo",
          email: "Correo Electrónico",
          password: "Contraseña",
          sizes: {
            studio: "Estudio / 1 Habitación",
            small: "1-2 Habitaciones",
            medium: "3-4 Habitaciones",
            large: "5+ Habitaciones",
            office: "Oficina / Comercial"
          },
          storage: {
            label: "Necesidades de Almacenaje",
            question: "¿Necesitas almacenamiento o te mudas a/de una bodega?",
            options: {
              none: "No, solo mudanza",
              need: "Necesito rentar una bodega",
              ustorage: "Me mudo a/de u-Storage",
              other: "Tengo bodega en otro lado"
            }
          },
          addons: {
            title: "Servicios Adicionales",
            insurance: "Seguro de Mudanza",
            insuranceDesc: "Protege tus pertenencias contra daños o pérdidas",
            packing: "Servicio de Empaque",
            packingDesc: "Empaque profesional para todos tus artículos",
            unpacking: "Servicio de Desempaque",
            unpackingDesc: "Ayuda para desempacar y organizar en tu nuevo hogar",
            box: "Cajas de Mudanza",
            boxDesc: "Cajas y materiales de empaque de alta calidad"
          },
          validation: {
            required: "Requerido",
            email: "Correo electrónico inválido",
            minChars: "La cadena debe contener al menos {{count}} carácter(es)"
          },
          next: "Siguiente Paso",
          back: "Atrás",
          submit: "Ver Estimaciones",
          createAndSubmit: "Crear Cuenta y Solicitar Cotización Final",
          submitQuote: "Enviar Solicitud de Cotización"
        },
        stepOf: "Paso {{current}} de {{total}}",
        chat: {
          intro: "¡Hola! Soy Clara, tu asistente de mudanzas IA. Te ayudaré a crear tu inventario. Empecemos por la Sala - ¿qué muebles grandes tienes ahí?",
          placeholder: "Escribe tu mensaje...",
          responses: {
            sofa: "Entendido, agregué un sofá. ¿Algo más en la sala?",
            tv: "Agregué la TV. ¿Tienes un mueble para la TV también?",
            bed: "Anotado, una cama. ¿Es King, Queen o Individual?",
            table: "Mesa de comedor agregada. ¿Cuántas sillas?",
            finish: "¡Genial! Por favor revisa tu lista de inventario a la derecha.",
            default: "Lo he anotado. ¿Qué más?"
          }
        },
        summaryPanel: {
          byRoom: "Por Habitación",
          byType: "Por Tipo",
          items: "Artículos",
          rooms: {
            "Living Room": "Sala",
            "Bedroom": "Recámara",
            "Kitchen": "Cocina",
            "Dining Room": "Comedor"
          },
          categories: {
            "Furniture": "Muebles",
            "Electronics": "Electrónicos",
            "Boxes": "Cajas"
          },
          itemsList: {
            "Sofa": "Sofá",
            "TV Stand": "Mueble TV",
            "TV": "TV",
            "Queen Bed": "Cama Queen",
            "Bed": "Cama",
            "Dining Table": "Mesa Comedor",
            "Boxes (L)": "Cajas (G)"
          }
        }
      },
      dashboard: {
        client: {
          title: "Panel de Control",
          welcome: "Bienvenido de nuevo",
          activeMoves: "Mudanzas Activas",
          activeMovesSub: "Programadas para la próxima semana",
          pendingQuotes: "Cotizaciones Pendientes",
          pendingQuotesSub: "Todo al día",
          completedMoves: "Mudanzas Completadas",
          completedMovesSub: "Entregadas exitosamente",
          savedAddresses: "Direcciones Guardadas",
          savedAddressesSub: "Casa y Oficina",
          recentActivity: "Actividad Reciente",
          noRecentActivity: "Sin actividad reciente",
          myMoves: "Mis Mudanzas",
          noActiveMoves: "No hay mudanzas activas",
          noCompletedMoves: "Sin mudanzas completadas aún",
          addAddress: "Agregar Dirección",
          quotes: "Cotizaciones",
          allQuotes: "Todas las Cotizaciones",
          noQuotes: "Sin cotizaciones aún. ¡Comienza con tu primera cotización!",
          profile: "Perfil",
          settings: "Configuración",
          nav: {
            overview: "Panel",
            moves: "Mis Mudanzas",
            quotes: "Cotizaciones",
            saved: "Direcciones"
          }
        },
        mover: {
          title: "Panel de Transportista",
          welcome: "Bienvenido, FastMoves Inc.",
          newQuote: "Nueva Solicitud",
          activeJobs: "Trabajos Activos",
          activeJobsSub: "+2 desde la semana pasada",
          pendingQuotes: "Cotizaciones Pendientes",
          pendingQuotesSub: "Requiere atención",
          revenue: "Ingresos",
          revenueSub: "+10.1% desde el mes pasado",
          drivers: "Conductores",
          driversSub: "Activos ahora",
          jobsPlaceholder: "Lista de trabajos activos aparecerá aquí",
          quotesPlaceholder: "Interfaz de gestión de cotizaciones",
          fleetPlaceholder: "Resumen y estado de la flota vehicular",
          driversPlaceholder: "Listado y horarios de conductores",
          nav: {
            overview: "Panel",
            profile: "Perfil",
            jobs: "Trabajos Activos",
            quotes: "Cotizaciones",
            fleet: "Flota",
            drivers: "Conductores"
          },
          profile: {
            title: "Perfil de Empresa",
            verified: "Verificado",
            pending: "Verificación Pendiente",
            company: "Información de la Empresa",
            contact: "Datos de Contacto",
            fleet: "Flota y Equipo",
            services: "Servicios y Cobertura",
            years: "años",
            noProfile: "No se encontró información del perfil",
            complete: "Completar Perfil",
            edit: "Editar",
            editTitle: "Editar Perfil",
            updateSuccess: "Perfil actualizado correctamente",
            updateError: "Error al actualizar el perfil",
            noContact: "No hay información de contacto aún",
            noFleet: "No hay información de flota aún",
            noServices: "No hay servicios agregados aún"
          }
        },
        admin: {
          title: "Portal de Administración",
          welcome: "Resumen de administración de plataforma",
          subtitle: "Resumen de la Plataforma",
          emergencyStop: "Parada de Emergencia",
          totalQuotes: "Cotizaciones Totales",
          totalQuotesSub: "+12 desde la semana pasada",
          activeUsers: "Usuarios Activos",
          activeUsersSub: "+5% de crecimiento",
          activeMovers: "Socios Activos",
          activeMoversSub: "Socios verificados",
          revenue: "Ingresos",
          revenueSub: "+8.2% desde el mes pasado",
          recentQuotes: "Cotizaciones Recientes",
          pendingApprovals: "Aprobaciones Pendientes",
          quotesPlaceholder: "Todas las cotizaciones aparecerán aquí",
          approvalsPlaceholder: "Solicitudes de verificación de socios",
          allQuotes: "Todas las Cotizaciones",
          allUsers: "Todos los Usuarios",
          usersPlaceholder: "Interfaz de gestión de usuarios",
          allMovers: "Todos los Socios",
          moversPlaceholder: "Gestión de socios transportistas",
          settingsDesc: "Configuración de la plataforma",
          settingsPlaceholder: "Ajustes y configuración de la plataforma",
          nav: {
            overview: "Resumen",
            quotes: "Cotizaciones",
            partners: "Socios",
            movers: "Socios",
            users: "Usuarios",
            verification: "Verificación",
            settings: "Configuración"
          },
          status: {
            active: "Activo",
            inactive: "Inactivo"
          },
          admins: {
            title: "Control de Acceso Admin",
            description: "Gestionar administradores de la plataforma y sus niveles de permisos",
            add: "Agregar Nuevo Admin",
            addDescription: "Agregar un nuevo administrador a la plataforma. Recibirá un correo para establecer su contraseña.",
            addButton: "Agregar Admin",
            selectRole: "Seleccionar rol",
            table: {
              name: "Nombre",
              email: "Correo",
              role: "Rol",
              status: "Estado",
              actions: "Acciones"
            },
            roles: {
              super: "Super Admin",
              support: "Soporte",
              viewer: "Observador"
            }
          },
          partners: {
            title: "Gestión de Socios",
            subtitle: "Empresas Asociadas",
            description: "Ver y gestionar todas las empresas de mudanzas registradas y su estado de incorporación",
            empty: "No hay socios registrados aún",
            vehicles: "vehículos",
            crew: "miembros del equipo",
            add: "Nuevo Socio",
            newPartnerTitle: "Registrar Nuevo Socio",
            newPartnerDescription: "Agregar una nueva empresa de mudanzas a la plataforma",
            create: "Crear Socio",
            createSuccess: "Socio creado exitosamente",
            createError: "Error al crear socio",
            form: {
              userInfo: "Persona de Contacto",
              companyInfo: "Información de la Empresa",
              fullName: "Nombre Completo",
              email: "Correo Electrónico",
              phone: "Teléfono",
              companyName: "Nombre de la Empresa",
              businessEmail: "Correo Corporativo",
              contactPhone: "Teléfono de Contacto",
              taxId: "RFC",
              fleetSize: "Tamaño de Flota",
              crewSize: "Tamaño del Equipo"
            },
            table: {
              company: "Empresa",
              contact: "Contacto",
              fleet: "Flota",
              services: "Servicios",
              status: "Estado",
              actions: "Acciones"
            },
            status: {
              verified: "Verificado",
              pending: "Verificación Pendiente",
              profileComplete: "Perfil Completo",
              inProgress: "En Progreso",
              started: "Iniciado"
            }
          },
          users: {
            title: "Gestión de Usuarios",
            sectionTitle: "Gestión de Usuarios",
            newRegistrations: "Nuevos Registros (Hoy)",
            totalUsers: "Total de Usuarios",
            manage: "Gestionar Usuarios",
            add: "Nuevo Usuario",
            newUserTitle: "Crear Nuevo Usuario",
            newUserDescription: "Agregar un nuevo usuario a la plataforma",
            create: "Crear Usuario",
            createSuccess: "Usuario creado exitosamente",
            createError: "Error al crear usuario",
            form: {
              fullName: "Nombre Completo",
              email: "Correo Electrónico",
              phone: "Teléfono",
              userType: "Tipo de Usuario"
            },
            types: {
              client: "Cliente",
              mover: "Transportista",
              admin: "Administrador"
            }
          },
          verification: {
            title: "Cola de Verificación",
            sectionTitle: "Centro de Verificación",
            pendingMovers: "Aprobaciones Pendientes",
            documentReviews: "Revisiones de Documentos",
            review: "Revisar Cola"
          },
          settings: {
            title: "Configuración del Sistema",
            placeholder: "Configuración de la plataforma"
          }
        }
      },
      quotes: {
        status: {
          intake: "Recibida",
          triage: "En Revisión",
          bidding_open: "Recibiendo Ofertas",
          selection: "Seleccionando Socio",
          confirmed: "Confirmada",
          scheduled: "Programada",
          completed: "Completada",
          cancelled: "Cancelada"
        },
        admin: {
          title: "Gestión de Cotizaciones",
          subtitle: "Solicitudes de Cotización",
          description: "Ver y gestionar las solicitudes de cotización de clientes a través del ciclo de licitación",
          empty: "No se encontraron cotizaciones",
          items: "artículos",
          bidsReceived: "ofertas",
          invited: "invitados",
          updateSuccess: "Cotización actualizada exitosamente",
          biddingOpened: "Licitación abierta para socios",
          partnerInvited: "Socio invitado exitosamente",
          bidAccepted: "Oferta aceptada, socio asignado",
          quoteDetails: "Detalles de la Cotización",
          createdAt: "Creada",
          customer: "Cliente",
          route: "Ruta",
          moveDate: "Fecha de Mudanza",
          dateNotSet: "Fecha no definida",
          homeSize: "Tamaño del Hogar",
          inventory: "Inventario",
          noInventory: "Sin artículos en inventario",
          services: "Servicios",
          addOns: "Extras",
          pricing: "Precios",
          suggestedPrice: "Precio Sugerido",
          finalPrice: "Precio Final",
          notes: "Notas del Admin",
          notesPlaceholder: "Agregar notas internas sobre esta cotización...",
          bids: "Ofertas",
          noBids: "Aún no hay ofertas enviadas",
          crew: "equipo",
          acceptBid: "Aceptar",
          invitedPartners: "Socios Invitados",
          noInvitations: "Aún no hay socios invitados",
          invitePartner: "Invitar Socio",
          alreadyInvited: "Invitado",
          invite: "Invitar",
          vehicles: "vehículos",
          noVerifiedPartners: "No hay socios verificados disponibles",
          assignedPartner: "Socio Asignado",
          startReview: "Iniciar Revisión",
          openBidding: "Abrir Licitación",
          closeBidding: "Cerrar Licitación",
          openBiddingTitle: "Abrir Licitación",
          openBiddingDescription: "Establecer un precio sugerido para guiar las ofertas de socios",
          startBidding: "Iniciar Licitación",
          invitePartnerTitle: "Invitar Socio",
          invitePartnerDescription: "Seleccionar un socio verificado para invitar a ofertar en esta cotización",
          table: {
            customer: "Cliente",
            route: "Ruta",
            date: "Fecha",
            items: "Artículos",
            bids: "Ofertas",
            status: "Estado",
            actions: "Acciones"
          },
          newQuote: "Nueva Cotización",
          newQuoteTitle: "Crear Nueva Cotización",
          newQuoteDescription: "Ingresar manualmente una solicitud de cotización para un cliente",
          createQuote: "Crear Cotización",
          createSuccess: "Cotización creada exitosamente",
          createError: "Error al crear cotización",
          form: {
            customerName: "Nombre del Cliente",
            customerEmail: "Correo del Cliente",
            customerPhone: "Teléfono del Cliente",
            fromAddress: "Dirección Origen",
            toAddress: "Dirección Destino",
            moveDate: "Fecha de Mudanza",
            homeSize: "Tamaño del Hogar",
            storageOption: "Opción de Almacenaje",
            notes: "Notas",
            notesPlaceholder: "Detalles adicionales sobre la mudanza...",
            homeSizes: {
              studio: "Estudio",
              "1bed": "1 Recámara",
              "2bed": "2 Recámaras",
              "3bed": "3 Recámaras",
              "4bed": "4+ Recámaras",
              house: "Casa",
              office: "Oficina"
            },
            storage: {
              none: "Sin Almacenaje",
              short: "Almacenaje Corto Plazo",
              long: "Almacenaje Largo Plazo"
            }
          }
        },
        mover: {
          title: "Oportunidades de Cotización",
          subtitle: "Solicitudes de Cotización",
          description: "Ver invitaciones de cotización y enviar tus ofertas",
          noInvitations: "No hay invitaciones de cotización en este momento",
          noBids: "Aún no has enviado ninguna oferta",
          unknownLocation: "Ubicación no especificada",
          dateNotSet: "Fecha no definida",
          items: "artículos",
          quoteDetails: "Detalles de la Cotización",
          invitedAt: "Invitado",
          route: "Ruta",
          moveDate: "Fecha de Mudanza",
          homeSize: "Tamaño del Hogar",
          inventory: "Inventario",
          noInventory: "Sin detalles de inventario",
          suggestedPrice: "Precio Sugerido",
          noPriceSuggested: "Sin precio sugerido",
          suggestedPriceNote: "Puedes ofertar por debajo o por encima de este monto",
          adminMessage: "Mensaje del Admin",
          respondBy: "Responder antes de",
          submitBid: "Enviar Oferta",
          decline: "Rechazar",
          invitationDeclined: "Invitación rechazada",
          bidSubmitted: "Oferta enviada exitosamente",
          bidAlreadySubmitted: "Ya has enviado una oferta para esta cotización",
          submitBidTitle: "Enviar tu Oferta",
          submitBidDescription: "Ingresa tu precio y disponibilidad para este trabajo",
          bidAmount: "Monto de tu Oferta",
          estimatedHours: "Horas Estimadas",
          crewSize: "Tamaño del Equipo",
          bidNotes: "Notas",
          bidNotesPlaceholder: "Agregar detalles sobre tu oferta (opcional)...",
          adjustmentReason: "Motivo del cambio de precio",
          adjustmentReasonPlaceholder: "Explica por qué estás cambiando el precio...",
          adjustmentReasonHelp: "Como tu oferta difiere del precio sugerido, explica el motivo",
          adjustmentReasonRequired: "Por favor explica por qué estás cambiando el precio",
          confirmBid: "Enviar Oferta",
          withdrawBid: "Retirar",
          bidWithdrawn: "Oferta retirada",
          crew: "equipo",
          tabs: {
            invitations: "Invitaciones",
            myBids: "Mis Ofertas"
          },
          status: {
            new: "Nueva",
            viewed: "Vista",
            bidSubmitted: "Oferta Enviada",
            declined: "Rechazada",
            expired: "Expirada"
          },
          bidStatus: {
            submitted: "Pendiente",
            accepted: "Aceptada",
            rejected: "Rechazada",
            withdrawn: "Retirada"
          }
        }
      },
      footer: {
        description: "Tu mudanza y tu bodega, en un solo lugar. U-Storage Go conecta la coordinación de tu mudanza con las bodegas U-Storage.",
        quickLinks: "Enlaces Rápidos",
        company: "Empresa",
        contact: "Contáctanos",
        privacy: "Política de Privacidad",
        terms: "Términos de Servicio",
        rights: "Todos los derechos reservados."
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "es", // Default to Spanish as requested
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
