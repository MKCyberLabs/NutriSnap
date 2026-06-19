# Development & Debugging Workflow Rules

1. **Step-by-Step Thought Process**: Always think step-by-step for implementations and debugging. 
2. **Detailed Notes**: Maintain detailed notes of your thought process and execution in a dedicated markdown (`.md`) file during major tasks.
3. **Comprehensive Testing**: For any new code, always write comprehensive test cases to verify the logic before completing the task.
4. **Database & ORM Migrations**: Whenever updating the ORM schema or creating database scripts, ensure that the exact Docker and migration commands are tested locally. They must never cause errors, break the production build, or negatively affect git pushes.
5. **Documentation**: Always maintain and update proper documentation of all setup, environment, and running steps in the `README.md` file.
