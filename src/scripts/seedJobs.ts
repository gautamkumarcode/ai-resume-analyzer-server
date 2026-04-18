import dotenv from "dotenv";
import { connectDB } from "../config/database";
import { Job, User } from "../models";

dotenv.config();

const sampleJobs = [
	{
		title: "Senior Full Stack Developer",
		company: "TechCorp Solutions",
		location: "San Francisco, CA",
		type: "full-time",
		description:
			"We are seeking an experienced Full Stack Developer to join our dynamic team. You will be responsible for developing and maintaining web applications using modern technologies.",
		requirements: [
			"5+ years of experience in full-stack development",
			"Strong proficiency in React, Node.js, and TypeScript",
			"Experience with MongoDB or PostgreSQL",
			"Knowledge of cloud platforms (AWS, Azure, or GCP)",
			"Excellent problem-solving skills",
		],
		skills: [
			"React",
			"Node.js",
			"TypeScript",
			"MongoDB",
			"AWS",
			"Docker",
			"Git",
		],
		salary: {
			min: 120000,
			max: 180000,
			currency: "USD",
		},
	},
	{
		title: "Frontend Developer",
		company: "Digital Innovations Inc",
		location: "New York, NY",
		type: "full-time",
		description:
			"Join our creative team to build beautiful and responsive user interfaces. We're looking for someone passionate about creating exceptional user experiences.",
		requirements: [
			"3+ years of frontend development experience",
			"Expert knowledge of React and modern JavaScript",
			"Experience with CSS frameworks (Tailwind, Material-UI)",
			"Understanding of responsive design principles",
			"Portfolio of previous work required",
		],
		skills: [
			"React",
			"JavaScript",
			"HTML5",
			"CSS3",
			"Tailwind CSS",
			"Redux",
			"Webpack",
		],
		salary: {
			min: 90000,
			max: 130000,
			currency: "USD",
		},
	},
	{
		title: "Backend Engineer",
		company: "CloudScale Systems",
		location: "Austin, TX",
		type: "full-time",
		description:
			"We're building scalable microservices architecture and need a talented backend engineer to help us grow. You'll work on high-performance APIs and distributed systems.",
		requirements: [
			"4+ years of backend development experience",
			"Strong knowledge of Node.js or Python",
			"Experience with microservices architecture",
			"Database design and optimization skills",
			"Understanding of RESTful API design",
		],
		skills: [
			"Node.js",
			"Python",
			"PostgreSQL",
			"Redis",
			"Docker",
			"Kubernetes",
			"GraphQL",
		],
		salary: {
			min: 110000,
			max: 160000,
			currency: "USD",
		},
	},
	{
		title: "DevOps Engineer",
		company: "Infrastructure Pro",
		location: "Seattle, WA",
		type: "full-time",
		description:
			"Help us build and maintain robust CI/CD pipelines and cloud infrastructure. We're looking for someone who loves automation and infrastructure as code.",
		requirements: [
			"3+ years of DevOps experience",
			"Strong knowledge of AWS or Azure",
			"Experience with Kubernetes and Docker",
			"Proficiency in scripting (Bash, Python)",
			"CI/CD pipeline experience (Jenkins, GitLab CI)",
		],
		skills: [
			"AWS",
			"Kubernetes",
			"Docker",
			"Terraform",
			"Jenkins",
			"Python",
			"Linux",
		],
		salary: {
			min: 115000,
			max: 165000,
			currency: "USD",
		},
	},
	{
		title: "UI/UX Designer",
		company: "Creative Studio Labs",
		location: "Los Angeles, CA",
		type: "full-time",
		description:
			"We're seeking a talented UI/UX designer to create intuitive and beautiful digital experiences. You'll work closely with developers and product managers.",
		requirements: [
			"3+ years of UI/UX design experience",
			"Proficiency in Figma and Adobe Creative Suite",
			"Strong portfolio demonstrating design thinking",
			"Understanding of user research methodologies",
			"Experience with design systems",
		],
		skills: [
			"Figma",
			"Adobe XD",
			"Sketch",
			"Prototyping",
			"User Research",
			"Wireframing",
			"Design Systems",
		],
		salary: {
			min: 85000,
			max: 125000,
			currency: "USD",
		},
	},
	{
		title: "Data Scientist",
		company: "Analytics Insights",
		location: "Boston, MA",
		type: "full-time",
		description:
			"Join our data science team to build predictive models and extract insights from large datasets. You'll work on machine learning projects that drive business decisions.",
		requirements: [
			"Master's degree in Computer Science, Statistics, or related field",
			"3+ years of data science experience",
			"Strong Python and SQL skills",
			"Experience with machine learning frameworks",
			"Statistical analysis and modeling expertise",
		],
		skills: [
			"Python",
			"TensorFlow",
			"PyTorch",
			"SQL",
			"Pandas",
			"Scikit-learn",
			"Jupyter",
		],
		salary: {
			min: 125000,
			max: 175000,
			currency: "USD",
		},
	},
	{
		title: "Mobile App Developer (React Native)",
		company: "MobileFirst Technologies",
		location: "Chicago, IL",
		type: "full-time",
		description:
			"Build cross-platform mobile applications using React Native. We're creating innovative mobile solutions for millions of users.",
		requirements: [
			"3+ years of mobile development experience",
			"Strong React Native expertise",
			"Experience with iOS and Android platforms",
			"Knowledge of mobile UI/UX best practices",
			"App Store and Play Store deployment experience",
		],
		skills: [
			"React Native",
			"JavaScript",
			"iOS",
			"Android",
			"Redux",
			"Firebase",
			"REST APIs",
		],
		salary: {
			min: 100000,
			max: 145000,
			currency: "USD",
		},
	},
	{
		title: "Product Manager",
		company: "Innovation Labs",
		location: "Denver, CO",
		type: "full-time",
		description:
			"Lead product strategy and roadmap for our SaaS platform. You'll work with cross-functional teams to deliver features that delight customers.",
		requirements: [
			"5+ years of product management experience",
			"Strong analytical and strategic thinking skills",
			"Experience with Agile methodologies",
			"Excellent communication and leadership abilities",
			"Technical background preferred",
		],
		skills: [
			"Product Strategy",
			"Agile",
			"JIRA",
			"User Stories",
			"Analytics",
			"Roadmapping",
			"Stakeholder Management",
		],
		salary: {
			min: 130000,
			max: 180000,
			currency: "USD",
		},
	},
	{
		title: "Junior Software Engineer",
		company: "StartupHub",
		location: "Remote",
		type: "full-time",
		description:
			"Perfect opportunity for recent graduates or early-career developers. You'll learn from experienced engineers while contributing to real projects.",
		requirements: [
			"Bachelor's degree in Computer Science or related field",
			"0-2 years of professional experience",
			"Strong foundation in programming fundamentals",
			"Eagerness to learn and grow",
			"Good communication skills",
		],
		skills: [
			"JavaScript",
			"Python",
			"Git",
			"HTML/CSS",
			"Problem Solving",
			"Teamwork",
		],
		salary: {
			min: 65000,
			max: 85000,
			currency: "USD",
		},
	},
	{
		title: "Machine Learning Engineer",
		company: "AI Innovations Corp",
		location: "San Jose, CA",
		type: "full-time",
		description:
			"Work on cutting-edge AI and machine learning projects. You'll develop and deploy ML models that solve real-world problems at scale.",
		requirements: [
			"4+ years of ML engineering experience",
			"Strong Python and deep learning expertise",
			"Experience with TensorFlow or PyTorch",
			"Knowledge of MLOps and model deployment",
			"Published research or contributions to open source preferred",
		],
		skills: [
			"Python",
			"TensorFlow",
			"PyTorch",
			"Keras",
			"MLOps",
			"Docker",
			"AWS SageMaker",
		],
		salary: {
			min: 140000,
			max: 200000,
			currency: "USD",
		},
	},
	{
		title: "QA Automation Engineer",
		company: "Quality First Software",
		location: "Portland, OR",
		type: "full-time",
		description:
			"Build and maintain automated testing frameworks to ensure software quality. You'll work closely with development teams to catch bugs early.",
		requirements: [
			"3+ years of QA automation experience",
			"Strong knowledge of testing frameworks (Selenium, Cypress)",
			"Programming skills in JavaScript or Python",
			"Experience with CI/CD integration",
			"Understanding of testing best practices",
		],
		skills: [
			"Selenium",
			"Cypress",
			"Jest",
			"JavaScript",
			"Python",
			"Jenkins",
			"API Testing",
		],
		salary: {
			min: 95000,
			max: 135000,
			currency: "USD",
		},
	},
	{
		title: "Cybersecurity Analyst",
		company: "SecureNet Solutions",
		location: "Washington, DC",
		type: "full-time",
		description:
			"Protect our systems and data from security threats. You'll monitor, detect, and respond to security incidents while implementing best practices.",
		requirements: [
			"3+ years of cybersecurity experience",
			"Knowledge of security frameworks (NIST, ISO 27001)",
			"Experience with SIEM tools",
			"Understanding of network security",
			"Security certifications (CISSP, CEH) preferred",
		],
		skills: [
			"Network Security",
			"SIEM",
			"Penetration Testing",
			"Incident Response",
			"Firewall Management",
			"Vulnerability Assessment",
		],
		salary: {
			min: 105000,
			max: 155000,
			currency: "USD",
		},
	},
];

async function seedJobs() {
	try {
		console.log("🌱 Starting job seeding process...");

		// Connect to database
		await connectDB();

		// Find a recruiter user (or create one if none exists)
		let recruiter = await User.findOne({ role: "recruiter" });

		if (!recruiter) {
			console.log("📝 No recruiter found. Creating a default recruiter...");
			recruiter = await User.create({
				email: "recruiter@example.com",
				password: "password123",
				firstName: "John",
				lastName: "Recruiter",
				role: "recruiter",
			});
			console.log("✅ Default recruiter created");
		}

		console.log(`👤 Using recruiter: ${recruiter.email}`);

		// Clear existing jobs (optional - comment out if you want to keep existing jobs)
		const existingJobsCount = await Job.countDocuments();
		if (existingJobsCount > 0) {
			console.log(`🗑️  Clearing ${existingJobsCount} existing jobs...`);
			await Job.deleteMany({});
		}

		// Create jobs
		console.log(`📋 Creating ${sampleJobs.length} sample jobs...`);

		const jobPromises = sampleJobs.map((jobData) =>
			Job.create({
				...jobData,
				user: recruiter._id,
			}),
		);

		const createdJobs = await Promise.all(jobPromises);

		console.log(`✅ Successfully created ${createdJobs.length} jobs!`);
		console.log("\n📊 Job Summary:");
		createdJobs.forEach((job, index) => {
			console.log(`   ${index + 1}. ${job.title} at ${job.company}`);
		});

		console.log("\n🎉 Seeding completed successfully!");
		console.log(
			`\n💡 You can now login as recruiter: ${recruiter.email} / password123`,
		);

		process.exit(0);
	} catch (error) {
		console.error("❌ Error seeding jobs:", error);
		process.exit(1);
	}
}

// Run the seed function
seedJobs();
